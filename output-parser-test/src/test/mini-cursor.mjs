// ========== 依赖与配置 ==========
// 加载 .env 中的环境变量（如 OPENAI_API_KEY、OPENAI_BASE_URL）
import "dotenv/config";
// 使用 LangChain 的 OpenAI 兼容聊天模型（可换成其他兼容接口）
import { ChatOpenAI } from "@langchain/openai";
// 消息类型：用户消息、系统提示、工具返回结果
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
// 内存中的对话历史，用于多轮对话
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
// 把模型返回的 tool_calls 解析成可用的工具调用对象
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
// 自定义的四个工具：读文件、写文件、执行命令、列目录
import {
  executeCommandTool,
  listDirectoryTool,
  readFileTool,
  writeFileTool,
} from "./all-tools.mjs";
import chalk from "chalk";

// 创建聊天模型实例（temperature=0 表示输出更稳定、少随机）
const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 工具列表：AI 在对话中可以主动调用这些工具
const tools = [
  readFileTool,
  writeFileTool,
  executeCommandTool,
  listDirectoryTool,
];

// 把工具“绑定”到模型上，模型才能知道可以调用哪些工具、以及如何传参
const modelWithTools = model.bindTools(tools);

/**
 * Agent 主函数：根据用户问题，循环「AI 思考 → 可选工具调用 → 把结果塞回对话」直到 AI 不再调工具为止
 * @param {string} query - 用户输入的问题或任务描述
 * @param {number} maxIterations - 最多循环次数，防止死循环，默认 30
 * @returns {Promise<string>} 最后一轮 AI 的纯文本回复
 */
async function runAgentWithTools(query, maxIterations = 30) {
  // 本轮对话的“聊天记录”，每次调用 runAgentWithTools 都会新建一个
  const history = new InMemoryChatMessageHistory();

  // 系统提示：告诉 AI 你是谁、当前目录、有哪些工具、以及使用工具的规则
  await history.addMessage(
    new SystemMessage(`你是一个项目管理助手，使用工具完成任务。

当前工作目录: ${process.cwd()}

工具：
1. read_file: 读取文件
2. write_file: 写入文件
3. execute_command: 执行命令（支持 workingDirectory 参数）
4. list_directory: 列出目录

重要规则 - execute_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }

重要规则 - write_file：
- 当写入 React 组件文件（如 App.tsx）时，如果存在对应的 CSS 文件（如 App.css），在其他 import 语句后加上这个 css 的导入
`)
  );

  // 把用户这一句话加入历史，这样模型看到的对话就是：系统提示 + 用户问题
  await history.addMessage(new HumanMessage(query));

  // 多轮循环：每一轮 AI 可能先“说话”，再决定是否调工具；若调了工具，就把工具结果塞回历史，再跑下一轮
  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));

    // 取出到目前为止的完整对话（系统 + 用户 + 之前的 AI + 工具结果）
    const messages = await history.getMessages();

    // 流式调用模型：一边生成一边返回 chunk，而不是等整段话生成完再返回
    const rawStream = await modelWithTools.stream(messages);

    // 用所有 chunk 拼成一条完整的 AI 消息，后面要用来解析 tool_calls 并写入 history
    let fullAIMessage = null;

    // 解析器：从 AIMessage 里把 tool_calls 解析成 { type, args, id } 等结构（支持流式过程中增量解析）
    const toolParser = new JsonOutputToolsParser();

    // 流式打印时避免重复：记录每个 write_file 调用已经打印过的内容长度，只打印“新增”的那一段
    const printedLengths = new Map();

    console.log(chalk.bgBlue(`\n🚀 Agent 开始思考并生成流...\n`));

    // 消费流：每来一个 chunk 就处理一次
    for await (const chunk of rawStream) {
      // 把当前 chunk 拼到已有消息上，得到“到目前为止的完整 AI 回复”
      fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

      // 尝试从当前完整消息里解析出工具调用（流式时 JSON 可能不完整，所以会抛错，忽略即可）
      let parsedTools = null;
      try {
        parsedTools = await toolParser.parseResult([
          { message: fullAIMessage },
        ]);
      } catch (e) {
        // 解析失败说明 tool_calls 的 JSON 还不完整，继续等后续 chunk
      }

      if (parsedTools && parsedTools.length > 0) {
        // 已经解析出工具调用了：若是 write_file，则对 content 做流式打印（只打新增部分）
        for (const toolCall of parsedTools) {
          if (toolCall.type === "write_file" && toolCall.args?.content) {
            const toolCallId =
              toolCall.id || toolCall.args.filePath || "default";
            const currentContent = String(toolCall.args.content);
            const previousLength = printedLengths.get(toolCallId);

            if (previousLength === undefined) {
              printedLengths.set(toolCallId, 0);
              console.log(
                chalk.bgBlue(
                  `\n[工具调用] write_file("${toolCall.args.filePath}") - 开始写入（流式预览）\n`
                )
              );
            }

            if (currentContent.length > previousLength) {
              const newContent = currentContent.slice(previousLength);
              process.stdout.write(newContent);
              printedLengths.set(toolCallId, currentContent.length);
            }
          }
        }
      } else {
        // 还没解析出工具调用：说明当前是普通文本，直接流式输出到终端
        if (chunk.content) {
          process.stdout.write(
            typeof chunk.content === "string"
              ? chunk.content
              : JSON.stringify(chunk.content)
          );
        }
      }
    }

    // 流结束，此时 fullAIMessage 就是本轮的完整 AI 消息，写入历史供下一轮使用
    await history.addMessage(fullAIMessage);
    console.log(chalk.green("\n✅ 消息已完整存入历史"));

    // 若本轮没有任何 tool_calls，说明 AI 已经“说完了”，不再需要调工具，直接返回最终回复
    if (!fullAIMessage.tool_calls || fullAIMessage.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${fullAIMessage.content}\n`);
      return fullAIMessage.content;
    }

    // 有工具调用：按顺序执行每个 tool_call，并把执行结果以 ToolMessage 形式追加到 history
    for (const toolCall of fullAIMessage.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);
        await history.addMessage(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          })
        );
      }
    }
    // 下一轮 for 循环会再次调用模型，此时历史里已经多了“工具结果”，AI 会基于结果继续思考或调工具
  }

  // 理论上不会走到这里（正常会在上面 return）；若循环用尽，返回最后一条消息的内容
  const finalMessages = await history.getMessages();
  return finalMessages[finalMessages.length - 1].content;
}

// 示例任务：让 Agent 创建并配置一个 React TodoList 项目（会用到 list_directory、execute_command、write_file 等）
const case1 = `创建一个功能丰富的 React TodoList 应用：

1. 创建项目：echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts
2. 修改 src/App.tsx，实现完整功能的 TodoList：
 - 添加、删除、编辑、标记完成
 - 分类筛选（全部/进行中/已完成）
 - 统计信息显示
 - localStorage 数据持久化
3. 添加复杂样式：
 - 渐变背景（蓝到紫）
 - 卡片阴影、圆角
 - 悬停效果
4. 添加动画：
 - 添加/删除时的过渡动画
 - 使用 CSS transitions
5. 列出目录确认

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果

去掉 main.tsx 里的 index.css 导入

之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run dev 启动服务器
`;

// 入口：执行 Agent，传入上面的任务描述；出错时只打印错误信息
try {
  await runAgentWithTools(case1);
} catch (error) {
  console.error(`\n❌ 错误: ${error.message}\n`);
}

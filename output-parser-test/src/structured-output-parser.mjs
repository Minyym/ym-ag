/**
 * StructuredOutputParser 示例
 * 作用：让大模型按「固定字段」返回内容，便于程序直接当对象用，不用自己写正则或手切字符串。
 */

// 从 .env 加载环境变量（API Key、模型名、baseURL 等）
import "dotenv/config";
// LangChain 的 OpenAI 对话模型封装
import { ChatOpenAI } from "@langchain/openai";
// 结构化输出解析器：把模型返回的文本解析成「键值对」对象
import { StructuredOutputParser } from "@langchain/core/output_parsers";

// 初始化模型：创建一个可调用的 ChatOpenAI 实例
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,       // 模型名，如 gpt-4
  apiKey: process.env.OPENAI_API_KEY,     // OpenAI（或兼容接口）的 API Key
  temperature: 0,                         // 0 = 更稳定、可复现，适合要「按格式输出」的场景
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL, // 可换成兼容 OpenAI 的代理/自建地址
  },
});

// 定义「希望模型按什么字段返回」：键 = 程序里用的字段名，值 = 给模型看的说明（会塞进 prompt）
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  name: "姓名",
  birth_year: "出生年份",
  nationality: "国籍",
  major_achievements: "主要成就，用逗号分隔的字符串",
  famous_theory: "著名理论",
});

// 拼出完整提问：你的问题 + 解析器自动生成的「格式说明」（告诉模型必须按哪种格式输出）
const question = `请介绍一下爱因斯坦的信息。

${parser.getFormatInstructions()}`;

console.log("question:", question);

try {
  console.log("🤔 正在调用大模型（使用 StructuredOutputParser）...\n");

  // 发请求，拿到模型的原始回复（通常是一大段带格式的文本）
  const response = await model.invoke(question);

  console.log("📤 模型原始响应:\n");
  console.log(response.content);

  // 用解析器把 response.content 解析成对象，字段就是上面定义的 name、birth_year 等
  const result = await parser.parse(response.content);

  console.log("\n✅ StructuredOutputParser 自动解析的结果:\n");
  console.log(result);
  // 之后就可以像普通对象一样用 result.xxx
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`著名理论: ${result.famous_theory}`);
  console.log(`主要成就: ${result.major_achievements}`);
} catch (error) {
  // 解析失败（模型没按格式输出）或网络错误时会进这里
  console.error("❌ 错误:", error.message);
}

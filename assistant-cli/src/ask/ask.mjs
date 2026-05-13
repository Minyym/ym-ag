/**
 * ask.mjs —— 回答用户问题的核心模块
 *
 * 整体流程（小白版）：
 * 1. 准备好 AI 模型、向量工具、历史记忆。
 * 2. 定义三个“工具”：查联系人、查日记、搜知识库（AI 会根据问题自己决定要不要用、用哪个）。
 * 3. 把【系统设定 + 历史对话 + 当前问题】发给 AI，让 AI 流式输出；如果 AI 说“我要调工具”，就执行工具并把结果塞回对话，再让 AI 继续，如此循环最多 5 轮。
 * 4. 把最终回答和问题一起存进记忆，下次对话还能用。
 */

import { z } from "zod"; // 用来定义“工具”的入参格式，并做校验
import { getModel } from "../llm/model.mjs";
import { getEmbeddings } from "../llm/embeddings.mjs"; // 把文字变成向量，用于语义搜索
import {
  findContactByPhone,
  findContactByWechat,
  findContactByName,
  findDiaryByDate,
} from "../mysql/query.mjs";
import { searchKnowledge } from "../milvus/search.mjs";
import { ensureKnowledgeCollection } from "../milvus/ensure-collection.mjs";
import { ensureSummary, getHistory } from "../memory/memory.mjs";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools"; // 定义一个“带参数格式”的工具，AI 会按格式传参

// ========== 下面两个是流式输出和工具调用时的辅助函数 ==========

/**
 * 从 AI 返回的一小块（chunk）里取出“文本内容”。
 * 流式输出时 AI 是一小段一小段返回的，这里把这一段里的字拼出来。
 */
function extractDelta(chunk) {
  if (typeof chunk?.content === "string") return chunk.content;
  if (Array.isArray(chunk?.content)) {
    return chunk.content
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
  }
  return "";
}

/**
 * 核心函数：根据用户问题给出回答（可能先调工具再回答）
 * @param {string} question - 用户输入的问题，例如 "138 是谁" / "2024-01-15 我记了什么"
 */
export async function answerQuestion(question) {
  // ---------- 1. 初始化：模型、向量、Milvus 知识库 ----------
  const model = getModel();
  const embeddings = getEmbeddings();
  await ensureKnowledgeCollection();

  // ---------- 2. 记忆：加载历史对话，太长则先做摘要 ----------
  const history = await getHistory();
  await ensureSummary(history);
  const historyMessages = await history.getMessages();

  // ---------- 3. 定义三个“工具”：AI 会根据问题自动选择调用 ----------
  const tools = [
    /** 工具一：查联系人（按手机号 / 姓名 / 微信号） */
    new DynamicStructuredTool({
      name: "lookup_contact",
      description:
        "按手机号/姓名/微信查询联系人。返回联系人列表（JSON）。当用户问“某手机号是谁/谁在某公司/某人信息”等时优先使用。",
      schema: z
        .object({
          phone: z.string().optional().describe("手机号（纯数字或包含空格/短横线）"),
          name: z.string().optional().describe("姓名（如 张三）"),
          wechat: z.string().optional().describe("微信号"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .default(5)
            .describe("最多返回多少条"),
        })
        .refine((v) => v.phone || v.name || v.wechat, {
          message: "phone/name/wechat 至少提供一个",
        }),
      func: async ({ phone, name, wechat, limit }) => {
        process.stderr.write(
          `[lookup_contact] 被调用 phone=${JSON.stringify(phone)} name=${JSON.stringify(name)} wechat=${JSON.stringify(wechat)} limit=${limit}\n`,
        );
        const results = [];
        // 按传入的 phone/name/wechat 分别查 MySQL，结果合并
        if (phone) {
          const digits = String(phone).replace(/[^\d]/g, "");
          if (digits.length >= 7) {
            const rows = await findContactByPhone(digits);
            results.push(
              ...rows.map((r) => ({
                name: r.name,
                phone: r.phone,
                wechat: r.wechat ?? null,
                company: r.company ?? null,
                title: r.title ?? null,
              })),
            );
          }
        }
        if (wechat) {
          const rows = await findContactByWechat(String(wechat).trim());
          results.push(
            ...rows.map((r) => ({
              name: r.name,
              phone: r.phone ?? null,
              wechat: r.wechat,
              company: r.company ?? null,
              title: r.title ?? null,
            })),
          );
        }
        if (name) {
          const rows = await findContactByName(String(name).trim());
          results.push(
            ...rows.map((r) => ({
              name: r.name,
              phone: r.phone ?? null,
              wechat: r.wechat ?? null,
              company: r.company ?? null,
              title: r.title ?? null,
            })),
          );
        }
        // 去重：同一人可能被 phone/name/wechat 查到多次，只保留一条，且不超过 limit 条
        const seen = new Set();
        const deduped = [];
        for (const item of results) {
          const key = `${item.name || ""}|${item.phone || ""}|${item.wechat || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(item);
          if (deduped.length >= limit) break;
        }
        process.stderr.write(`[lookup_contact] 返回 ${deduped.length} 条\n`);
        return deduped;
      },
    }),
    /** 工具二：按日期查日记（格式 YYYY-MM-DD） */
    new DynamicStructuredTool({
      name: "find_diary",
      description:
        "按日期（YYYY-MM-DD）查日记。返回日记列表（JSON）。当用户问“某天发生了什么/某天日记/某天心情”时使用。",
      schema: z.object({
        date: z.string().describe("日期，格式 YYYY-MM-DD"),
      }),
      func: async ({ date }) => {
        const rows = await findDiaryByDate(date);
        return rows.map((r) => ({
          date: r.date,
          mood: r.mood ?? null,
          content: r.content,
        }));
      },
    }),
    /** 工具三：语义搜索知识库（把 query 转成向量，在 Milvus 里找最像的 k 条） */
    new DynamicStructuredTool({
      name: "search_kb",
      description:
        "在知识库里按语义搜索相关片段。返回片段列表（JSON）。当用户问概念解释、项目背景等需要检索资料时使用。",
      schema: z.object({
        query: z.string().describe("要搜索的查询文本"),
        k: z.number().int().min(1).max(10).default(3).describe("返回条数"),
      }),
      func: async ({ query, k }) => {
        const vector = await embeddings.embedQuery(query);
        const snippets = await searchKnowledge(vector, k);
        return snippets.map((s) => ({ content: s.content }));
      },
    }),
  ];

  // ---------- 4. 把“工具”绑定到模型上，AI 在回复时就可以声明要调用哪个工具、传什么参数 ----------
  const toolModel = model.bindTools(tools);

  // ---------- 5. 组装发给 AI 的消息：系统人设 + 历史对话 + 当前问题 ----------
  const messages = [
    new SystemMessage(
      "你是严谨的个人知识库助手。遇到不确定的信息，凡涉及手机号必须先调用工具,优先调用工具检索证据再回答。最终回答必须用中文，且不要重复输出同一句话。",
    ),
    ...historyMessages,
    new HumanMessage(`用户问题：${question}`),
  ];

  // ---------- 6. 多轮对话：流式用 concat(chunk) 累积（与 mini-cursor 一致），有 tool_calls 则执行并塞回，最多 5 轮 ----------
  const maxIters = 5;
  let fullText = "";
  let finalAIMessage = null;

  for (let iter = 0; iter < maxIters; iter++) {
    // 6.1 流式请求：用 concat 累积成本轮完整 AI 消息（LangChain 内部会按 index 合并 tool_calls）
    let fullAIMessage = null;
    const stream = await toolModel.stream(messages);
    for await (const chunk of stream) {
      fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;
      const delta = extractDelta(chunk);
      if (delta) {
        process.stdout.write(delta);
        fullText += delta;
      }
    }

    // 6.2 本轮没有工具调用则结束
    const toolCalls = fullAIMessage?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      finalAIMessage = fullAIMessage;
      break;
    }

    // 6.3 有工具调用：把合并后的整条消息追加到 messages（不再手写 AIMessage，避免半截 tool_calls）
    messages.push(fullAIMessage);

    // 6.4 逐个执行工具，结果以 ToolMessage 追加
    for (const call of toolCalls) {
      const toolName = call?.name;
      const toolCallId = call?.id;
      let toolArgs = call?.args;
      if (typeof toolArgs === "string") {
        try {
          toolArgs = JSON.parse(toolArgs);
        } catch {
          toolArgs = { __raw: toolArgs };
        }
      }

      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            content: JSON.stringify({ error: `未知工具: ${toolName}` }),
          }),
        );
        continue;
      }

      try {
        const result = await tool.invoke(toolArgs);
        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            content: JSON.stringify(result),
          }),
        );
      } catch (err) {
        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            content: JSON.stringify({ error: err?.message || String(err) }),
          }),
        );
      }
    }
  }

  if (fullText.length > 0) process.stdout.write("\n");
  const response = finalAIMessage ?? new AIMessage(fullText);

  // ---------- 7. 把本轮问答写入记忆，下次 getHistory() 时能看到 ----------
  await history.addMessage(new HumanMessage(question));
  await history.addMessage(response);

  return fullText;
}

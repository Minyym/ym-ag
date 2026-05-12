import "dotenv/config";

import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import { z } from "zod";

import { getProductBySku } from "./inventory-mock.mjs";

const getProductStock = tool(async ({ sku }) => getProductBySku(sku), {
  name: "get_product_stock",
  description: "按 SKU 查商品名与库存，SKU 如 SKU-001。",
  schema: z.object({
    sku: z.string().describe("商品 SKU"),
  }),
});

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

/** 用户消息
   ↓
LLM 判断是否调用工具
   ↓
调用 tool
   ↓
工具结果返回给 LLM
   ↓
LLM 整理最终答案
你几乎不用关心：
bindTools
ToolNode
ConditionalEdges
START / END
toolsCondition
等等图相关的东西，createAgent 和工具会帮你处理好。
你只需要写好工具函数和提示语，createAgent 会帮你把它们组装成一个能用的智能体（agent）。 */

const agent = createAgent({
  model,
  tools: [getProductStock],
  systemPrompt:
    "你是仓库助手。问库存时必须调用 get_product_stock（模拟数据），禁止编造。",
  checkpointer: new MemorySaver(),
});

const result = await agent.invoke(
  { messages: [new HumanMessage("SKU-002 还剩多少库存？")] },
  { configurable: { thread_id: "demo-thread" } },
);

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await agent.graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const last = result.messages.at(-1);
console.log(last?.content ?? result);

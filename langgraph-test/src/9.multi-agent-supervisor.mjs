import "dotenv/config";

import { HumanMessage } from "@langchain/core/messages";
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import { z } from "zod";

import { lookupCityTrivia, lookupWeather } from "./simple-mock.mjs";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const lookupWeatherTool = tool(async ({ city }) => lookupWeather(city), {
  name: "lookup_weather",
  description: "查询某城市当日天气概况（气温区间、天气、空气质量等）。",
  schema: z.object({
    city: z.string().describe("城市名，如 杭州"),
  }),
});

const lookupCityTriviaTool = tool(async ({ city }) => lookupCityTrivia(city), {
  name: "lookup_city_trivia",
  description: "查询与某城市相关的一句趣味知识。",
  schema: z.object({
    city: z.string().describe("城市名，如 杭州"),
  }),
});

/** 子代理 A：只回答「天气」类问题 */
const weatherAgent = createAgent({
  name: "weather_agent",
  description: "专门查天气",
  model,
  tools: [lookupWeatherTool],
  systemPrompt:
    "你只处理天气。用户提到城市时，用 lookup_weather 查询后再用中文简短说明。",
});

/** 子代理 B：只回答「城市小知识」 */
const triviaAgent = createAgent({
  name: "trivia_agent",
  description: "专门讲与城市相关的小知识；必须调用 lookup_city_trivia。",
  model,
  tools: [lookupCityTriviaTool],
  systemPrompt:
    "你只讲城市小知识。先 lookup_city_trivia，再用人话转述，不要编造工具里没有的内容。",
});

/**
 * Supervisor：根据用户问的是「天气」还是「小知识」切换子代理。
 * （真实业务里还可以再加更多子代理，思路一样。）
 */
const workflow = createSupervisor({
  agents: [weatherAgent.graph, triviaAgent.graph],
  llm: model,
  prompt: `你是调度员，只负责选人，不要自己报气温、也不要自己讲城市百科。

- 问天气、气温、下不下雨、空气 → 用 weather_agent
- 问小知识、名胜、历史、一句介绍 → 用 trivia_agent
`,
});

const app = workflow.compile();

const drawable = await app.getGraphAsync();
console.log(drawable.drawMermaid({ withStyles: true }));

const input = {
  messages: [
    new HumanMessage("查一下杭州的天气，再讲一条和杭州有关的小知识。"),
  ],
};

const nodePath = [];
let finalState = null;
// stream 是一个异步迭代器，迭代过程中会不断产出事件；每个事件是一个数组，第一项是 mode，
// 第二项是 payload。mode 是字符串，表示事件类型；
// payload 是事件数据，可能是对象，也可能是其他类型，具体取决于 mode。
const stream = await app.stream(input, { streamMode: ["updates", "values"] });

// for await 循环会不断等待 stream 产出事件，每当有新事件时，就会执行循环体；
// 在循环体里，我们根据 mode 的不同来处理 payload：
// 如果 mode 是 "updates"，我们把 payload 的键名加入 nodePath；
// 如果 mode 是 "values"，我们把 payload 赋值给 finalState。
// 这样，nodePath 就记录了图执行过程中经过的节点路径，finalState 则是图执行完成后的最终状态。
for await (const event of stream) {
  const [mode, payload] = event;
  if (mode === "updates" && payload && typeof payload === "object") {
    nodePath.push(...Object.keys(payload));
  } else if (mode === "values") {
    finalState = payload;
  }
}

console.log("路径:", nodePath.join(" → "));
const last = finalState?.messages?.at(-1);
console.log(last?.content ?? finalState?.messages);

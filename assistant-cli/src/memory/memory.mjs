import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  getBufferString,
} from "@langchain/core/messages";
import { getEncoding } from "js-tiktoken";
import { getConfig } from "../config.mjs";
import { getModel } from "../llm/model.mjs";

function countTokens(messages, enc) {
  let total = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    total += enc.encode(content).length;
  }
  return total;
}

export async function getHistory(sessionId = "default") {
  const cfg = getConfig();
  return new FileSystemChatMessageHistory({
    filePath: cfg.memoryFile,
    sessionId,
  });
}

export async function ensureSummary(history) {
  const cfg = getConfig();
  const model = getModel();
  const enc = getEncoding("cl100k_base");

  const allMessages = await history.getMessages();
  const totalTokens = countTokens(allMessages, enc);
  if (totalTokens <= cfg.memoryMaxTokens) return;

  const keepRecent = [];
  let keepTokens = 0;
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i];
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const t = enc.encode(content).length;
    if (keepTokens + t <= cfg.memoryKeepTokens) {
      keepRecent.unshift(msg);
      keepTokens += t;
    } else {
      break;
    }
  }

  const toSummarize = allMessages.slice(0, allMessages.length - keepRecent.length);
  const conversationText = getBufferString(toSummarize, {
    humanPrefix: "用户",
    aiPrefix: "助手",
  });

  const prompt = `请将以下对话压缩成简明摘要，保留事实与关键偏好：\n\n${conversationText}\n\n摘要：`;
  const summaryRes = await model.invoke([
    new SystemMessage("你是对话摘要助手。"),
    new HumanMessage(prompt),
  ]);

  await history.clear();
  await history.addMessage(new SystemMessage(`摘要：${summaryRes.content}`));
  for (const msg of keepRecent) {
    if (msg._getType() === "human") {
      await history.addMessage(new HumanMessage(msg.content));
    } else if (msg._getType() === "ai") {
      await history.addMessage(new AIMessage(msg.content));
    } else {
      await history.addMessage(msg);
    }
  }
}

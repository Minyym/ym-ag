import { getModel } from "../llm/model.mjs";
import { getEmbeddings } from "../llm/embeddings.mjs";
import {
  findContactByPhone,
  findContactByWechat,
  findContactByName,
  findDiaryByDate,
  recentContacts,
  recentDiaries,
} from "../mysql/query.mjs";
import { searchKnowledge } from "../milvus/search.mjs";
import { ensureKnowledgeCollection } from "../milvus/ensure-collection.mjs";
import { ensureSummary, getHistory } from "../memory/memory.mjs";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

function extractPhone(text) {
  const m = text.match(/\d{7,}/);
  return m ? m[0] : null;
}

function extractDate(text) {
  const m = text.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function extractName(text) {
  const m = text.match(/(叫|是)([\u4e00-\u9fa5]{2,4})/);
  return m ? m[2] : null;
}

export async function answerQuestion(question) {
  const model = getModel();
  const embeddings = getEmbeddings();
  await ensureKnowledgeCollection();

  const facts = [];
  const phone = extractPhone(question);
  const date = extractDate(question);
  const name = extractName(question);

  if (phone) {
    const rows = await findContactByPhone(phone);
    rows.forEach((r) => facts.push(`联系人：${r.name}，电话：${r.phone}`));
  }

  if (question.includes("微信")) {
    const rows = await findContactByWechat(question.replace("微信", "").trim());
    rows.forEach((r) => facts.push(`联系人：${r.name}，微信：${r.wechat}`));
  }

  if (name) {
    const rows = await findContactByName(name);
    rows.forEach((r) => facts.push(`联系人：${r.name}，公司：${r.company || "未知"}，职位：${r.title || "未知"}`));
  }

  if (date) {
    const rows = await findDiaryByDate(date);
    rows.forEach((r) => facts.push(`日记：${r.date}，心情：${r.mood || "未知"}，内容：${r.content}`));
  }

  if (facts.length === 0) {
    const [contacts, diaries] = await Promise.all([
      recentContacts(2),
      recentDiaries(2),
    ]);
    contacts.forEach((r) =>
      facts.push(`联系人：${r.name}，公司：${r.company || "未知"}，职位：${r.title || "未知"}`)
    );
    diaries.forEach((r) =>
      facts.push(`日记：${r.date}，心情：${r.mood || "未知"}，内容：${r.content}`)
    );
  }

  const queryVector = await embeddings.embedQuery(question);
  const snippets = await searchKnowledge(queryVector, 3);

  const snippetText = snippets
    .map((s, i) => `[片段${i + 1}] ${s.content}`)
    .join("\n");

  const history = await getHistory();
  await ensureSummary(history);
  const historyMessages = await history.getMessages();

  const prompt = `你是一个联系人/日记/知识库助手。优先使用事实，再参考语义片段。
如果没有相关信息，请明确说明“没有找到相关信息”。

事实：
${facts.join("\n")}

语义片段：
${snippetText || "无"}

问题：${question}

回答：`;

  const messages = [
    new SystemMessage("你是严谨的个人知识库助手。"),
    ...historyMessages,
    new HumanMessage(prompt),
  ];

  const response = await model.invoke(messages);
  await history.addMessage(new HumanMessage(question));
  await history.addMessage(response);
  return response.content;
}

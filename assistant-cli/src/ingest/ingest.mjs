import { getModel } from "../llm/model.mjs";
import { getEmbeddings } from "../llm/embeddings.mjs";
import { contactSchema, diarySchema, kbSchema } from "../schemas.mjs";
import { insertContact, insertDiary, insertKnowledge } from "../mysql/insert.mjs";
import { ensureKnowledgeCollection } from "../milvus/ensure-collection.mjs";
import { insertKnowledge as insertKnowledgeVector } from "../milvus/insert.mjs";

function buildContactText(c) {
  return `联系人：${c.name}，公司：${c.company || "未知"}，职位：${c.title || "未知"}，电话：${c.phone || "未知"}，微信：${c.wechat || "未知"}，标签：${(c.tags || []).join(",")}`;
}

function buildDiaryText(d) {
  return `日记：${d.date}，心情：${d.mood || "未知"}，内容：${d.content}`;
}

function buildKbText(k) {
  return `知识：${k.title}\n${k.content}`;
}

function extractJson(text) {
  const raw = typeof text === "string" ? text : JSON.stringify(text);
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  if (raw.includes("```")) {
    return raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return raw;
}

function mapChineseKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const mapped = { ...obj };
  const keyMap = {
    姓名: "name",
    性别: "gender",
    出生日期: "birth_date",
    出生时间: "birth_date",
    公司: "company",
    职位: "title",
    手机号: "phone",
    电话: "phone",
    微信: "wechat",
    标签: "tags",
    标题: "title",
    正文: "content",
    内容: "content",
    日期: "date",
    心情: "mood",
  };
  for (const [cn, en] of Object.entries(keyMap)) {
    if (cn in mapped && !(en in mapped)) {
      mapped[en] = mapped[cn];
    }
  }
  return mapped;
}

function applyDefaults(type, data, originalText) {
  if (type === "diary") {
    return {
      ...data,
      content: data.content ?? originalText,
    };
  }
  if (type === "kb") {
    return {
      ...data,
      content: data.content ?? originalText,
    };
  }
  return data;
}

async function invokeStructured(model, schema, prompt, type, originalText) {
  const response = await model.invoke(prompt);
  if (process.env.DEBUG_JSON) {
    const preview =
      typeof response.content === "string"
        ? response.content.slice(0, 200)
        : JSON.stringify(response.content).slice(0, 200);
    console.log("[DEBUG] raw content preview:", preview);
    console.log("[DEBUG] content type:", typeof response.content);
  }
  const jsonText = extractJson(response.content);
  const data = JSON.parse(jsonText);
  const mapped = mapChineseKeys(data);
  const normalized = applyDefaults(type, mapped, originalText);
  return schema.parse(normalized);
}

export async function parseAndInsert(type, text) {
  const model = getModel();
  const embeddings = getEmbeddings();

  await ensureKnowledgeCollection();

  if (type === "contact") {
    const structured = await invokeStructured(
      model,
      contactSchema,
      `请从以下文本中提取联系人信息，只输出 JSON。必须包含字段：name, gender, birth_date, company, title, phone, wechat, tags（缺失填 null）。\n${text}`,
      "contact",
      text
    );
    const id = await insertContact(structured);
    const content = buildContactText(structured);
    const vector = await embeddings.embedQuery(content);
    await insertKnowledgeVector({
      type: "contact",
      sourceId: id,
      content,
      vector,
      meta: structured,
    });
    return { id, type: "contact" };
  }

  if (type === "diary") {
    const structured = await invokeStructured(
      model,
      diarySchema,
      `请从以下文本中提取日记信息，只输出 JSON。必须包含字段：date, mood, content, tags（缺失填 null）。\n${text}`,
      "diary",
      text
    );
    const id = await insertDiary(structured);
    const content = buildDiaryText(structured);
    const vector = await embeddings.embedQuery(content);
    await insertKnowledgeVector({
      type: "diary",
      sourceId: id,
      content,
      vector,
      meta: structured,
    });
    return { id, type: "diary" };
  }

  if (type === "kb") {
    const structured = await invokeStructured(
      model,
      kbSchema,
      `请从以下文本中提取知识条目，只输出 JSON。必须包含字段：title, content, tags（缺失填 null）。\n${text}`,
      "kb",
      text
    );
    const id = await insertKnowledge(structured);
    const content = buildKbText(structured);
    const vector = await embeddings.embedQuery(content);
    await insertKnowledgeVector({
      type: "kb",
      sourceId: id,
      content,
      vector,
      meta: structured,
    });
    return { id, type: "kb" };
  }

  throw new Error(`不支持的类型: ${type}`);
}

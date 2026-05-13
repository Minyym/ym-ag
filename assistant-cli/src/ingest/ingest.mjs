/**
 * 这个文件的主要任务是：
 * 1. 接收一段乱七八糟的文本。
 * 2. 问问 AI：这里面有没有联系人、日记或者知识点？有的话给我整理成 JSON 格式。
 * 3. 把整理好的数据存进普通的数据库（MySQL）方便管理。
 * 4. 把数据转成“向量”存进向量数据库（Milvus），方便以后通过模糊的意思（语义）来搜索。
 */

import { getModel } from "../llm/model.mjs"; // 获取大语言模型（比如 GPT）
import { getEmbeddings } from "../llm/embeddings.mjs"; // 获取把文字转成向量（数字数组）的工具
import { contactSchema, diarySchema, kbSchema } from "../schemas.mjs"; // 导入数据的“模具”，用来检查 AI 返回的数据对不对
import {
  insertContact,
  insertDiary,
  insertKnowledge,
} from "../mysql/insert.mjs"; // 导入存入 MySQL 的函数
import { ensureKnowledgeCollection } from "../milvus/ensure-collection.mjs"; // 确保向量数据库里的“文件夹”已经建好了
import { insertKnowledge as insertKnowledgeVector } from "../milvus/insert.mjs"; // 把带向量的数据存入向量数据库

/**
 * 下面三个函数 (build...Text) 的作用是：
 * 把结构化的 JSON 数据拼回一段通顺的文字，方便存入向量数据库进行后续搜索。
 */
function buildContactText(c) {
  return `联系人：${c.name}，公司：${c.company || "未知"}，职位：${c.title || "未知"}，电话：${c.phone || "未知"}，微信：${c.wechat || "未知"}，标签：${(c.tags || []).join(",")}`;
}

function buildDiaryText(d) {
  return `日记：${d.date}，心情：${d.mood || "未知"}，内容：${d.content}`;
}

function buildKbText(k) {
  return `知识：${k.title}\n${k.content}`;
}

/**
 * 核心黑科技：从 AI 的废话里抠出 JSON 代码块
 * AI 有时候会说“好的，这是你要的 JSON：```json ... ```”，这个函数就是把中间的内容拿出来。
 */
function extractJson(text) {
  const raw = typeof text === "string" ? text : JSON.stringify(text);
  // 1. 尝试找 Markdown 格式的 JSON 块
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  // 2. 如果没有标记，尝试清理掉所有的反引号
  if (raw.includes("```")) {
    return raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
  }

  // 3. 最后大招：直接找第一个 { 和最后一个 } 之间的内容
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return raw;
}

/**
 * 翻译官：把 AI 返回的中文 Key 转换成代码用的英文 Key
 * AI 有时候会自作聪明返回 {"姓名": "张三"}，我们要把它变成 {"name": "张三"}
 */
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

/**
 * 补丁库：如果 AI 没提供内容，就把原始整段文本塞进去兜底
 */
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

/**
 * 调用 AI 获取结构化数据的封装函数
 */
async function invokeStructured(model, schema, prompt, type, originalText) {
  // 1. 让 AI 干活
  const response = await model.invoke(prompt);

  // 如果开启了调试模式，打印一下 AI 原汁原味的回答
  if (process.env.DEBUG_JSON) {
    const preview =
      typeof response.content === "string"
        ? response.content.slice(0, 200)
        : JSON.stringify(response.content).slice(0, 200);
    console.log("[DEBUG] raw content preview:", preview);
  }

  // 2. 从废话里提取 JSON 字符串
  const jsonText = extractJson(response.content);

  // 3. 把字符串转成 JS 对象
  const data = JSON.parse(jsonText);

  // 4. 处理中文字段映射
  const mapped = mapChineseKeys(data);

  // 5. 填补默认值
  const normalized = applyDefaults(type, mapped, originalText);

  // 6. 用“模具”（Zod Schema）做最后的质量检查，不合规就报错
  return schema.parse(normalized);
}

/**
 * 最终大管家：对外提供的唯一函数
 * @param {string} type - 数据类型 ('contact', 'diary', 'kb')
 * @param {string} text - 原始乱七八糟的文本
 */
export async function parseAndInsert(type, text) {
  const model = getModel(); // 叫个 AI 伙计
  const embeddings = getEmbeddings(); // 叫个翻译数字的小哥

  // 确保存向量的“文件夹”准备好了
  await ensureKnowledgeCollection();

  // 根据类型不同，走不同的路
  if (type === "contact") {
    // A. 提取信息
    const structured = await invokeStructured(
      model,
      contactSchema,
      `请从以下文本中提取联系人信息，只输出 JSON。必须包含字段：name, gender, birth_date, company, title, phone, wechat, tags（缺失填 null）。\n${text}`,
      "contact",
      text,
    );
    // B. 存入 MySQL 拿回一个 ID
    const id = await insertContact(structured);
    // C. 重新拼成一段方便搜索的话
    const content = buildContactText(structured);
    // D. 把这话转成一串数字（向量）
    const vector = await embeddings.embedQuery(content);
    // E. 存入向量数据库，带着 ID 和元数据，方便以后联表查询
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
      text,
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
      text,
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

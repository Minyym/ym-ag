import { getMysqlConnection } from "./client.mjs";

function normalizeTags(tags) {
  if (!tags || tags.length === 0) return null;
  return tags.join(",");
}

function normalizeField(value) {
  return value === undefined ? null : value;
}

export async function insertContact(contact) {
  const conn = await getMysqlConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO contacts (name, gender, birth_date, company, title, phone, wechat, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizeField(contact.name),
        normalizeField(contact.gender),
        normalizeField(contact.birth_date),
        normalizeField(contact.company),
        normalizeField(contact.title),
        normalizeField(contact.phone),
        normalizeField(contact.wechat),
        normalizeTags(contact.tags),
      ]
    );
    return result.insertId;
  } finally {
    await conn.end();
  }
}

export async function insertDiary(diary) {
  const conn = await getMysqlConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO diaries (date, mood, content, tags) VALUES (?, ?, ?, ?)`,
      [
        normalizeField(diary.date),
        normalizeField(diary.mood),
        normalizeField(diary.content),
        normalizeTags(diary.tags),
      ]
    );
    return result.insertId;
  } finally {
    await conn.end();
  }
}

export async function insertKnowledge(kb) {
  const conn = await getMysqlConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO knowledge (title, content, tags) VALUES (?, ?, ?)`,
      [
        normalizeField(kb.title),
        normalizeField(kb.content),
        normalizeTags(kb.tags),
      ]
    );
    return result.insertId;
  } finally {
    await conn.end();
  }
}

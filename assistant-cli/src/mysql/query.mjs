import { getMysqlConnection } from "./client.mjs";

/** 将字符串规整为纯数字（用于按手机号匹配，兼容库里带空格、横线等格式） */
function digitsOnly(s) {
  return String(s ?? "").replace(/\D/g, "");
}

export async function findContactByPhone(phone) {
  const conn = await getMysqlConnection();
  try {
    const digits = digitsOnly(phone);
    if (!digits || digits.length < 7) return [];
    if (process.env.DEBUG_SQL) {
      console.log("[DEBUG_SQL] findContactByPhone", digits);
    }
    // 精确匹配 或 库里 phone 去掉非数字后匹配（兼容 183 4567 7654、183-4567-7654 等）
    const [rows] = await conn.execute(
      `SELECT * FROM contacts
       WHERE phone = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone,''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', '') = ?
       LIMIT 5`,
      [digits, digits]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

export async function findContactByWechat(wechat) {
  const conn = await getMysqlConnection();
  try {
    if (process.env.DEBUG_SQL) {
      console.log("[DEBUG_SQL] findContactByWechat", wechat);
    }
    const [rows] = await conn.execute(
      `SELECT * FROM contacts WHERE wechat = ? LIMIT 3`,
      [wechat]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

export async function findContactByName(name) {
  const conn = await getMysqlConnection();
  try {
    if (process.env.DEBUG_SQL) {
      console.log("[DEBUG_SQL] findContactByName", name);
    }
    const [rows] = await conn.execute(
      `SELECT * FROM contacts WHERE name LIKE ? LIMIT 5`,
      [`%${name}%`]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

export async function findDiaryByDate(date) {
  const conn = await getMysqlConnection();
  try {
    if (process.env.DEBUG_SQL) {
      console.log("[DEBUG_SQL] findDiaryByDate", date);
    }
    const [rows] = await conn.execute(
      `SELECT * FROM diaries WHERE date = ? LIMIT 5`,
      [date]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

export async function recentContacts(limit = 3) {
  const conn = await getMysqlConnection();
  try {
    if (process.env.DEBUG_SQL) {
      console.log("[DEBUG_SQL] recentContacts", limit);
    }
    const safeLimit = Math.max(1, Number(limit) || 3);
    const [rows] = await conn.execute(
      `SELECT * FROM contacts ORDER BY id DESC LIMIT ${safeLimit}`
    );
    return rows;
  } finally {
    await conn.end();
  }
}

export async function recentDiaries(limit = 3) {
  const conn = await getMysqlConnection();
  try {
    if (process.env.DEBUG_SQL) {
      console.log("[DEBUG_SQL] recentDiaries", limit);
    }
    const safeLimit = Math.max(1, Number(limit) || 3);
    const [rows] = await conn.execute(
      `SELECT * FROM diaries ORDER BY id DESC LIMIT ${safeLimit}`
    );
    return rows;
  } finally {
    await conn.end();
  }
}

import { getMysqlConnection } from "./client.mjs";

export async function findContactByPhone(phone) {
  const conn = await getMysqlConnection();
  try {
    if (process.env.DEBUG_SQL) {
      console.log("[DEBUG_SQL] findContactByPhone", phone);
    }
    const [rows] = await conn.execute(
      `SELECT * FROM contacts WHERE phone = ? LIMIT 3`,
      [phone]
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

import mysql from "mysql2/promise";
import { getConfig } from "../config.mjs";

export async function getMysqlConnection() {
  const cfg = getConfig();
  const connection = await mysql.createConnection({
    host: cfg.mysql.host,
    port: cfg.mysql.port,
    user: cfg.mysql.user,
    password: cfg.mysql.password,
    database: cfg.mysql.database,
    multipleStatements: true,
  });
  return connection;
}

import mysql from "mysql2/promise";

// Credentials come from environment variables only (.env.local) - nothing is hard-coded.
const g = globalThis as unknown as { __mysqlPool?: mysql.Pool };

export const pool: mysql.Pool =
  g.__mysqlPool ??
  mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "garagebook_db",
    connectionLimit: 10,
    dateStrings: true, // keep DATE columns as 'YYYY-MM-DD' strings
    decimalNumbers: true, // DECIMAL columns as numbers, not strings
  });

if (process.env.NODE_ENV !== "production") g.__mysqlPool = pool;

export type Row = Record<string, any>;

export async function query<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = Row>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: any[] = []) {
  const [res] = await pool.query(sql, params);
  return res as mysql.ResultSetHeader;
}

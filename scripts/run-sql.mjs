// Runs a .sql file that may contain DELIMITER directives (mysql2 cannot do this itself).
// "Already exists" errors are skipped so the additions script can be re-run safely.
import fs from "node:fs";
import mysql from "mysql2/promise";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node run-sql.mjs <file.sql>");
  process.exit(1);
}

function splitStatements(text) {
  const statements = [];
  let delimiter = ";";
  let buffer = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/^DELIMITER\s+(\S+)$/i);
    if (m) {
      delimiter = m[1];
      continue;
    }
    if (line.startsWith("--") || line === "") continue;
    buffer += rawLine + "\n";
    if (line.endsWith(delimiter)) {
      const stmt = buffer.trim().slice(0, -delimiter.length).trim();
      if (stmt) statements.push(stmt);
      buffer = "";
    }
  }
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

// 1060 dup column, 1061 dup key name, 1050 table exists, 1826 dup FK/constraint name, 3822 dup check name
const SKIPPABLE = new Set([1060, 1061, 1050, 1826, 3822, 1022]);

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  multipleStatements: false,
});

const statements = splitStatements(fs.readFileSync(file, "utf8"));
let ok = 0, skipped = 0;
for (const stmt of statements) {
  const label = stmt.replace(/\s+/g, " ").slice(0, 70);
  try {
    await conn.query(stmt);
    ok++;
    console.log("OK      ", label);
  } catch (e) {
    if (SKIPPABLE.has(e.errno)) {
      skipped++;
      console.log("SKIPPED ", label, "(already applied)");
    } else {
      console.error("FAILED  ", label);
      console.error("        ", e.errno, e.sqlMessage || e.message);
      await conn.end();
      process.exit(1);
    }
  }
}
console.log(`\nDone: ${ok} applied, ${skipped} skipped.`);
await conn.end();

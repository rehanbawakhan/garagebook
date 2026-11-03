// DB-level test cases. Run AFTER seeding: npm run test:db
import mysql from "mysql2/promise";
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? "localhost", port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE ?? "garagebook_db", dateStrings: true, decimalNumbers: true,
});
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); console.log("PASS", name); pass++; } catch (e) { console.log("FAIL", name, "-", e.message); fail++; } };
const rejects = async (sql, params, code) => {
  try { await db.query(sql, params); } catch (e) { if (code && e.errno !== code) throw new Error(`wrong error ${e.errno}: ${e.message}`); return; }
  throw new Error("statement was accepted but should have been rejected");
};
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${b}, got ${a}`); };

await t("duplicate owner email rejected (UNIQUE)", () => rejects("INSERT INTO owner (name,email,phone,password_hash) VALUES ('x','rehan@example.com','1','h')", [], 1062));
await t("duplicate registration number rejected", () => rejects("INSERT INTO vehicle (owner_id,make,model,year,registration_no,vehicle_type) VALUES (1,'a','b',2020,'MH12AB1234','Car')", [], 1062));
await t("vehicle year outside 1980-2100 rejected (CHECK)", () => rejects("INSERT INTO vehicle (owner_id,make,model,year,registration_no,vehicle_type) VALUES (1,'a','b',1900,'ZZ00ZZ0000','Car')", [], 3819));
await t("vehicle with unknown owner rejected (FK)", () => rejects("INSERT INTO vehicle (owner_id,make,model,year,registration_no,vehicle_type) VALUES (9999,'a','b',2020,'ZZ11ZZ1111','Car')", [], 1452));
await t("insurance end before start rejected (CHECK)", () => rejects("INSERT INTO insurance (vehicle_id,provider,policy_number,start_date,end_date) VALUES (1,'p','BAD-1','2025-01-10','2025-01-01')", [], 3819));
await t("negative expense rejected (CHECK)", () => rejects("INSERT INTO expense (vehicle_id,expense_type,amount,expense_date) VALUES (1,'x',-5,CURDATE())", [], 3819));
await t("passwords are bcrypt hashes, not plain text", async () => {
  const [rows] = await db.query("SELECT password_hash FROM owner UNION ALL SELECT password_hash FROM workshop WHERE password_hash IS NOT NULL");
  if (!rows.length || !rows.every((r) => /^\$2[aby]\$10\$/.test(r.password_hash))) throw new Error("found a non-bcrypt value");
});
await t("trigger blocks using more stock than available", async () => {
  const [r] = await db.query("INSERT INTO service (vehicle_id,workshop_id,service_date,description,status) VALUES (1,1,CURDATE(),'trigger test','In Progress')");
  try { await rejects("INSERT INTO service_part (service_id,part_id,quantity_used,price_at_use) VALUES (?,1,99999,1)", [r.insertId], 1644); }
  finally { await db.query("DELETE FROM service WHERE service_id=?", [r.insertId]); }
});
await t("trigger deducts stock on insert and restores it on delete", async () => {
  const stock = async () => (await db.query("SELECT stock_quantity s FROM workshop_inventory WHERE workshop_id=1 AND part_id=5"))[0][0].s;
  const [r] = await db.query("INSERT INTO service (vehicle_id,workshop_id,service_date,description,status) VALUES (1,1,CURDATE(),'stock test','In Progress')");
  try {
    const before = await stock();
    await db.query("INSERT INTO service_part (service_id,part_id,quantity_used,price_at_use) VALUES (?,5,3,180)", [r.insertId]);
    eq(await stock(), before - 3);
    await db.query("DELETE FROM service_part WHERE service_id=? AND part_id=5", [r.insertId]);
    eq(await stock(), before);
  } finally { await db.query("DELETE FROM service WHERE service_id=?", [r.insertId]); }
});
await t("sp_generate_invoice computes totals and completes the service", async () => {
  const [r] = await db.query("INSERT INTO service (vehicle_id,workshop_id,service_date,description,status) VALUES (1,1,CURDATE(),'invoice test','In Progress')");
  try {
    await db.query("INSERT INTO service_part (service_id,part_id,quantity_used,price_at_use) VALUES (?,5,2,180)", [r.insertId]);
    const [res] = await db.query("CALL sp_generate_invoice(?,?,?)", [r.insertId, 500, 10]);
    const row = Array.isArray(res[0]) ? res[0][0] : res[0];
    eq(Number(row.parts_cost), 360); eq(Number(row.tax), 86); eq(Number(row.total_amount), 946);
    const [[s]] = await db.query("SELECT status FROM service WHERE service_id=?", [r.insertId]);
    eq(s.status, "Completed");
  } finally { await db.query("DELETE FROM service WHERE service_id=?", [r.insertId]); }
});
await t("procedure refuses to invoice a closed service (rolled back)", async () => {
  const [[s]] = await db.query("SELECT service_id FROM service WHERE status='Completed' LIMIT 1");
  await rejects("CALL sp_generate_invoice(?,0,0)", [s.service_id], 1644);
});
await t("paid invoice amounts are locked by trigger", async () => {
  const [[i]] = await db.query("SELECT invoice_id FROM invoice WHERE status='Paid' LIMIT 1");
  await rejects("UPDATE invoice SET total_amount = total_amount + 1 WHERE invoice_id=?", [i.invoice_id], 1644);
});
await t("view v_vehicle_cost_summary matches fn_vehicle_lifetime_cost", async () => {
  const [rows] = await db.query("SELECT vehicle_id, lifetime_cost, total_expenses+total_fuel+total_service AS manual FROM v_vehicle_cost_summary");
  for (const r of rows) if (Math.abs(r.lifetime_cost - r.manual) > 0.01) throw new Error(`vehicle ${r.vehicle_id} mismatch`);
});
await t("full-text search finds brake-related complaints", async () => {
  const [rows] = await db.query("SELECT complaint_id FROM repair_complaint WHERE MATCH(complaint_text) AGAINST ('brake' IN NATURAL LANGUAGE MODE)");
  if (!rows.length) throw new Error("no match");
});
await t("deleting an owner cascades to vehicles", async () => {
  const [o] = await db.query("INSERT INTO owner (name,email,phone,password_hash) VALUES ('tmp','tmp@x.com','1','h')");
  await db.query("INSERT INTO vehicle (owner_id,make,model,year,registration_no,vehicle_type) VALUES (?,'a','b',2020,'TMP0000','Car')", [o.insertId]);
  await db.query("DELETE FROM owner WHERE owner_id=?", [o.insertId]);
  const [[c]] = await db.query("SELECT COUNT(*) c FROM vehicle WHERE registration_no='TMP0000'");
  eq(c.c, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
await db.end();
process.exit(fail ? 1 : 0);

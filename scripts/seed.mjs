// Seeds demo data with properly hashed passwords. Usage: npm run db:seed  (add --reset to wipe first)
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";

const reset = process.argv.includes("--reset");
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE ?? "garagebook_db",
  dateStrings: true,
});

const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM owner");
if (n > 0 && !reset) {
  console.error("Owner table is not empty. Run `npm run db:reset` to wipe and reseed.");
  process.exit(1);
}
if (reset) {
  await db.query("SET FOREIGN_KEY_CHECKS=0");
  for (const t of ["repair_complaint","tyre","fuel_log","document","insurance","expense","service_part","workshop_inventory","invoice","service","vehicle","part","workshop","owner"]) {
    await db.query(`DELETE FROM ${t}`);
    await db.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`);
  }
  await db.query("SET FOREIGN_KEY_CHECKS=1");
}

const h = (p) => bcrypt.hash(p, 10);
const d = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

// Owners
const owners = [["Rehan Khan","rehan@example.com","9876500001","Owner@123"],["Aisha Patel","aisha@example.com","9876500002","Owner@123"]];
for (const [name,email,phone,pw] of owners)
  await db.query("INSERT INTO owner (name,email,phone,password_hash) VALUES (?,?,?,?)", [name,email,phone,await h(pw)]);

// Workshops
const shops = [["Speedy Motors","speedy@example.com","12 MG Road, Pune","9822000001",4.5],["City Auto Care","city@example.com","45 Station Rd, Pune","9822000002",4.1]];
for (const [name,email,addr,phone,rating] of shops)
  await db.query("INSERT INTO workshop (name,email,address,phone,rating,password_hash) VALUES (?,?,?,?,?,?)", [name,email,addr,phone,rating,await h("Workshop@123")]);

// Parts + inventory
const parts = [["Engine Oil 5W30","EO-5W30","Fluids"],["Oil Filter","OF-101","Filters"],["Brake Pad Set","BP-220","Brakes"],["Air Filter","AF-310","Filters"],["Spark Plug","SP-40","Ignition"],["Chain Lube","CL-9","Fluids"]];
for (const p of parts) await db.query("INSERT INTO part (part_name,part_number,category) VALUES (?,?,?)", p);
const inv = [[1,1,20,650],[1,2,15,250],[1,3,8,1800],[1,4,2,400],[1,5,30,180],[2,1,10,700],[2,3,6,1900],[2,6,12,150]];
for (const [w,p,s,pr] of inv) await db.query("INSERT INTO workshop_inventory (workshop_id,part_id,stock_quantity,unit_price) VALUES (?,?,?,?)", [w,p,s,pr]);

// Vehicles
const vehicles = [[1,"Honda","City",2019,"MH12AB1234","Car"],[1,"Royal Enfield","Classic 350",2021,"MH12CD5678","Bike"],[2,"Maruti","Swift",2018,"MH14EF9012","Car"]];
for (const v of vehicles) await db.query("INSERT INTO vehicle (owner_id,make,model,year,registration_no,vehicle_type) VALUES (?,?,?,?,?,?)", v);

// Services (parts go through the trigger, invoices through the stored procedure)
const svc = async (veh, shop, date, desc) => (await db.query("INSERT INTO service (vehicle_id,workshop_id,service_date,description,status) VALUES (?,?,?,?, 'In Progress')", [veh,shop,date,desc]))[0].insertId;
const use = async (s, part, qty) => {
  const [[r]] = await db.query("SELECT wi.unit_price FROM workshop_inventory wi JOIN service sv ON sv.workshop_id=wi.workshop_id WHERE sv.service_id=? AND wi.part_id=?", [s, part]);
  await db.query("INSERT INTO service_part (service_id,part_id,quantity_used,price_at_use) VALUES (?,?,?,?)", [s, part, qty, r.unit_price]);
};
const s1 = await svc(1,1,d(-90),"Full service: oil and filter change"); await use(s1,1,4); await use(s1,2,1);
await db.query("CALL sp_generate_invoice(?,?,?)", [s1, 1200, 18]);
await db.query("UPDATE invoice SET status='Paid' WHERE service_id=?", [s1]);
const s2 = await svc(2,2,d(-40),"Chain lubrication and brake check"); await use(s2,6,1); await use(s2,3,1);
await db.query("CALL sp_generate_invoice(?,?,?)", [s2, 800, 18]);
const s3 = await svc(1,1,d(-20),"Brake pad replacement"); await use(s3,3,1);
await db.query("CALL sp_generate_invoice(?,?,?)", [s3, 900, 18]);
const s4 = await svc(3,1,d(-1),"Engine noise inspection"); await use(s4,5,4);
await db.query("INSERT INTO service (vehicle_id,workshop_id,service_date,description,status) VALUES (3,2,?,?, 'Pending')", [d(0),"Annual service"]);

// Insurance, expenses, fuel, tyres, documents
await db.query("INSERT INTO insurance (vehicle_id,provider,policy_number,start_date,end_date,premium_amount,coverage_type) VALUES (1,'HDFC Ergo','POL-1001',?,?,14500,'Comprehensive'),(2,'ICICI Lombard','POL-1002',?,?,5200,'Third Party'),(3,'Bajaj Allianz','POL-1003',?,?,11000,'Comprehensive')", [d(-335),d(18),d(-300),d(65),d(-200),d(165)]);
await db.query("INSERT INTO expense (vehicle_id,expense_type,amount,expense_date,description) VALUES (1,'Parking',1500,?,'Monthly parking'),(1,'Wash',400,?,'Detailing'),(2,'Accessories',3200,?,'Crash guard'),(3,'Toll',650,?,'Expressway')", [d(-30),d(-10),d(-50),d(-5)]);
await db.query("INSERT INTO fuel_log (vehicle_id,fuel_date,liters,cost,odometer_reading) VALUES (1,?,35,3600,42100),(1,?,32,3350,42650),(2,?,12,1250,15300),(3,?,28,2900,60200)", [d(-25),d(-8),d(-15),d(-12)]);
await db.query("INSERT INTO tyre (vehicle_id,brand,position,install_date,expected_life_km,status) VALUES (1,'MRF','Front-Left',?,40000,'Active'),(1,'MRF','Front-Right',?,40000,'Active'),(3,'Apollo','Rear-Left',?,35000,'Worn')", [d(-400),d(-400),d(-900)]);
await db.query("INSERT INTO document (vehicle_id,doc_type,doc_number,issue_date,expiry_date) VALUES (1,'PUC','PUC-778',?,?),(2,'RC','RC-9921',?,NULL)", [d(-100),d(80),d(-700)]);

// Complaints (varied wording for the full-text search demo)
const comps = [
  [1,s1,"Engine makes a loud knocking noise when cold"],[1,s3,"Brake pedal feels soft and brakes squeal at low speed"],
  [2,s2,"Chain noise and rough gear shifting"],[3,s4,"Engine overheating in traffic and coolant smell"],
  [3,null,"AC not cooling properly on hot days"],[1,null,"Steering vibration above 80 km/h"],
];
for (const [v,s,t] of comps) await db.query("INSERT INTO repair_complaint (vehicle_id,service_id,complaint_text,complaint_date) VALUES (?,?,?,?)", [v,s,t,d(-15)]);

// MongoDB inspection reports
if (process.env.MONGODB_URI) {
  const mc = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  try {
    await mc.connect();
    const col = mc.db(process.env.MONGODB_DB ?? "garagebook").collection("service_reports");
    if (reset) await col.deleteMany({});
    await col.createIndex({ service_id: 1 }, { unique: true });
    await col.createIndex({ vehicle_type: 1, created_at: -1 });
    await col.createIndex({ workshop_id: 1, created_at: -1 });
    await col.createIndex({ issues: 1 });
    const now = new Date();
    const ago = (n) => new Date(Date.now() - n * 864e5);
    await col.insertMany([
      { service_id: s1, vehicle_id: 1, workshop_id: 1, vehicle_type: "Car", condition_score: 8, issues: ["Oil leak"], notes: "Healthy overall", checks: { brake_pad_mm: 6, tyre_tread_mm: 5, oil_level: "Full", ac_working: true, battery_voltage: 12.6 }, created_at: ago(90), updated_at: ago(90) },
      { service_id: s2, vehicle_id: 2, workshop_id: 2, vehicle_type: "Bike", condition_score: 6, issues: ["Chain wear", "Worn brake shoe"], notes: "Replace chain soon", checks: { chain_slack_mm: 35, sprocket_wear: "Moderate", brake_shoe_mm: 2, battery_voltage: 12.4 }, created_at: ago(40), updated_at: ago(40) },
      { service_id: s3, vehicle_id: 1, workshop_id: 1, vehicle_type: "Car", condition_score: 7, issues: ["Worn brake pads"], notes: "", checks: { brake_pad_mm: 1.5, tyre_tread_mm: 4, oil_level: "OK", ac_working: true, battery_voltage: 12.5 }, created_at: ago(20), updated_at: ago(20) },
    ]);
    console.log("MongoDB reports seeded");
  } catch (e) {
    console.warn("MongoDB not reachable, skipped reports:", e.message);
  } finally { await mc.close(); }
}

console.log("Seeded.\n  Owner:    rehan@example.com / Owner@123\n  Workshop: speedy@example.com / Workshop@123");
await db.end();

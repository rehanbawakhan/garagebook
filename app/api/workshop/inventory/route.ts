import { z } from "zod";
import { pool, query } from "@/lib/db";
import { bodyOf, guarded, ok } from "@/lib/http";

export const GET = guarded("workshop", async (_req, s) => {
  const rows = await query(
    `SELECT wi.part_id, p.part_name, p.part_number, p.category, wi.stock_quantity, wi.unit_price, wi.reorder_level
     FROM workshop_inventory wi JOIN part p ON p.part_id = wi.part_id
     WHERE wi.workshop_id = ?
     ORDER BY p.part_name`,
    [s.id]
  );
  return ok(rows);
});

const schema = z.object({
  part_number: z.string().trim().min(2).max(50),
  part_name: z.string().trim().min(2).max(100),
  category: z.string().trim().max(50).optional().default(""),
  add_quantity: z.coerce.number().int().min(0).max(100000),
  unit_price: z.coerce.number().min(0).max(1_000_000),
  reorder_level: z.coerce.number().int().min(0).max(10000).default(3),
});

// Application-level TRANSACTION: create the catalog part if new, then add stock - both or neither.
export const POST = guarded("workshop", async (req, s) => {
  const d = schema.parse(await bodyOf(req));
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [found] = (await conn.query("SELECT part_id FROM part WHERE part_number = ?", [d.part_number])) as any;
    let partId: number;
    if (found.length) {
      partId = found[0].part_id;
    } else {
      const [ins] = (await conn.query(
        "INSERT INTO part (part_name, part_number, category) VALUES (?, ?, ?)",
        [d.part_name, d.part_number, d.category || null]
      )) as any;
      partId = ins.insertId;
    }
    await conn.query(
      `INSERT INTO workshop_inventory (workshop_id, part_id, stock_quantity, unit_price, reorder_level)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + VALUES(stock_quantity),
                               unit_price = VALUES(unit_price), reorder_level = VALUES(reorder_level)`,
      [s.id, partId, d.add_quantity, d.unit_price, d.reorder_level]
    );
    await conn.commit();
    return ok({ part_id: partId }, 201);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

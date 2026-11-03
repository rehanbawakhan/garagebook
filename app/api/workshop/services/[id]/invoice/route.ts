import { z } from "zod";
import { pool, queryOne } from "@/lib/db";
import { bodyOf, fail, guarded, ok, toId } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  labor_cost: z.coerce.number().min(0).max(1_000_000),
  tax_rate: z.coerce.number().min(0).max(100),
});

// Calls the sp_generate_invoice STORED PROCEDURE: invoice insert + service completion in ONE transaction.
export const POST = guarded<Ctx>("workshop", async (req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid service", 400);
  const mine = await queryOne("SELECT 1 AS x FROM service WHERE service_id = ? AND workshop_id = ?", [id, s.id]);
  if (!mine) return fail("Service not found", 404);
  const d = schema.parse(await bodyOf(req));
  const [result] = (await pool.query("CALL sp_generate_invoice(?, ?, ?)", [id, d.labor_cost, d.tax_rate])) as any;
  const row = Array.isArray(result) ? result[0]?.[0] ?? result[0] : result;
  return ok(row, 201);
});

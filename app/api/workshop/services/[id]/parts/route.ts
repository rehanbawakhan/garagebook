import { z } from "zod";
import { execute, queryOne } from "@/lib/db";
import { bodyOf, fail, guarded, ok, toId } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

async function openService(id: number, workshopId: number) {
  return queryOne<{ status: string }>("SELECT status FROM service WHERE service_id = ? AND workshop_id = ?", [id, workshopId]);
}

const schema = z.object({ part_id: z.coerce.number().int().positive(), quantity_used: z.coerce.number().int().min(1).max(1000) });

// The price is read from this workshop's inventory on the server - the client cannot choose it.
// The trg_service_part_deduct_stock TRIGGER checks and deducts the stock.
export const POST = guarded<Ctx>("workshop", async (req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid service", 400);
  const sv = await openService(id, s.id);
  if (!sv) return fail("Service not found", 404);
  if (sv.status === "Completed" || sv.status === "Cancelled") return fail("This service is closed", 409);
  const d = schema.parse(await bodyOf(req));
  const inv = await queryOne<{ unit_price: number }>(
    "SELECT unit_price FROM workshop_inventory WHERE workshop_id = ? AND part_id = ?",
    [s.id, d.part_id]
  );
  if (!inv) return fail("This workshop does not stock that part", 404);
  try {
    await execute(
      "INSERT INTO service_part (service_id, part_id, quantity_used, price_at_use) VALUES (?, ?, ?, ?)",
      [id, d.part_id, d.quantity_used, inv.unit_price]
    );
  } catch (e: any) {
    if (e?.errno === 1062) return fail("Part already added - remove it first to change the quantity", 409);
    throw e;
  }
  if (sv.status === "Pending") await execute("UPDATE service SET status = 'In Progress' WHERE service_id = ?", [id]);
  return ok({ added: true }, 201);
});

// DELETE: the trg_service_part_restock TRIGGER returns the quantity to stock.
export const DELETE = guarded<Ctx>("workshop", async (req, s, ctx) => {
  const id = toId((await ctx.params).id);
  const partId = toId(new URL(req.url).searchParams.get("part_id") ?? "");
  if (!id || !partId) return fail("Invalid request", 400);
  const sv = await openService(id, s.id);
  if (!sv) return fail("Service not found", 404);
  if (sv.status === "Completed" || sv.status === "Cancelled") return fail("This service is closed", 409);
  const r = await execute("DELETE FROM service_part WHERE service_id = ? AND part_id = ?", [id, partId]);
  return r.affectedRows ? ok({ removed: true }) : fail("Part not on this service", 404);
});

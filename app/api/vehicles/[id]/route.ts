import { execute, queryOne } from "@/lib/db";
import { fail, guarded, ok, toId } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = guarded<Ctx>("owner", async (_req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid vehicle", 400);
  const v = await queryOne("SELECT * FROM v_vehicle_cost_summary WHERE vehicle_id = ? AND owner_id = ?", [id, s.id]);
  return v ? ok(v) : fail("Vehicle not found", 404);
});

export const DELETE = guarded<Ctx>("owner", async (_req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid vehicle", 400);
  const r = await execute("DELETE FROM vehicle WHERE vehicle_id = ? AND owner_id = ?", [id, s.id]);
  return r.affectedRows ? ok({ deleted: true }) : fail("Vehicle not found", 404);
});

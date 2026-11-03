import { execute, query, queryOne } from "@/lib/db";
import { bodyOf, fail, guarded, ok, toId } from "@/lib/http";
import { RECORD_KINDS, buildSchema } from "@/lib/records";

type Ctx = { params: Promise<{ id: string; kind: string }> };

async function resolve(ctx: Ctx, ownerId: number) {
  const p = await ctx.params;
  const vehicleId = toId(p.id);
  const kind = RECORD_KINDS[p.kind];
  if (!vehicleId || !kind) return null;
  const mine = await queryOne("SELECT 1 AS x FROM vehicle WHERE vehicle_id = ? AND owner_id = ?", [vehicleId, ownerId]);
  return mine ? { vehicleId, kind } : null;
}

export const GET = guarded<Ctx>("owner", async (_req, s, ctx) => {
  const r = await resolve(ctx, s.id);
  if (!r) return fail("Not found", 404);
  const cols = [r.kind.pk, ...r.kind.fields.map((f) => f.name)].join(", ");
  const rows = await query(
    `SELECT ${cols} FROM ${r.kind.table} WHERE vehicle_id = ? ORDER BY ${r.kind.orderBy}`,
    [r.vehicleId]
  );
  return ok(rows);
});

export const POST = guarded<Ctx>("owner", async (req, s, ctx) => {
  const r = await resolve(ctx, s.id);
  if (!r) return fail("Not found", 404);
  const data = buildSchema(r.kind).parse(await bodyOf(req)) as Record<string, unknown>;
  const names = r.kind.fields.map((f) => f.name);
  const res = await execute(
    `INSERT INTO ${r.kind.table} (vehicle_id, ${names.join(", ")}) VALUES (?, ${names.map(() => "?").join(", ")})`,
    [r.vehicleId, ...names.map((n) => data[n] ?? null)]
  );
  return ok({ id: res.insertId }, 201);
});

export const DELETE = guarded<Ctx>("owner", async (req, s, ctx) => {
  const r = await resolve(ctx, s.id);
  if (!r) return fail("Not found", 404);
  const rid = toId(new URL(req.url).searchParams.get("rid") ?? "");
  if (!rid) return fail("Missing record id", 400);
  const res = await execute(`DELETE FROM ${r.kind.table} WHERE ${r.kind.pk} = ? AND vehicle_id = ?`, [rid, r.vehicleId]);
  return res.affectedRows ? ok({ deleted: true }) : fail("Record not found", 404);
});

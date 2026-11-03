import { z } from "zod";
import { queryOne } from "@/lib/db";
import { reports } from "@/lib/mongo";
import { checksFor } from "@/lib/checks";
import { bodyOf, fail, guarded, ok, toId } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  condition_score: z.coerce.number().int().min(1).max(10),
  issues: z.array(z.string().trim().min(2).max(60)).max(10).default([]),
  notes: z.string().trim().max(1000).default(""),
  checks: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

// Inspection report stored as a MongoDB document (flexible per-vehicle-type checklist).
export const POST = guarded<Ctx>("workshop", async (req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid service", 400);
  const sv = await queryOne<{ vehicle_id: number; vehicle_type: string }>(
    `SELECT v.vehicle_id, v.vehicle_type FROM service sv JOIN vehicle v ON v.vehicle_id = sv.vehicle_id
     WHERE sv.service_id = ? AND sv.workshop_id = ?`,
    [id, s.id]
  );
  if (!sv) return fail("Service not found", 404);
  const d = schema.parse(await bodyOf(req));
  const allowed = new Set(checksFor(sv.vehicle_type).map((c) => c.name));
  const checks = Object.fromEntries(Object.entries(d.checks).filter(([k]) => allowed.has(k)));
  const col = await reports();
  await col.updateOne(
    { service_id: id },
    {
      $set: {
        workshop_id: s.id,
        vehicle_id: sv.vehicle_id,
        vehicle_type: sv.vehicle_type,
        checks,
        condition_score: d.condition_score,
        issues: [...new Set(d.issues.map((i) => i.toLowerCase()))],
        notes: d.notes,
        created_at: new Date(),
      },
    },
    { upsert: true }
  );
  return ok({ saved: true }, 201);
});

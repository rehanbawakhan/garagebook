import { z } from "zod";
import { execute, query, queryOne } from "@/lib/db";
import { reports } from "@/lib/mongo";
import { bodyOf, fail, guarded, ok, toId } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = guarded<Ctx>("workshop", async (_req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid service", 400);
  const service = await queryOne(
    `SELECT sv.service_id, sv.service_date, sv.description, sv.status, sv.total_cost,
            v.vehicle_id, v.registration_no, v.make, v.model, v.year, v.vehicle_type, o.name AS owner_name
     FROM service sv
     JOIN vehicle v ON v.vehicle_id = sv.vehicle_id
     JOIN owner o ON o.owner_id = v.owner_id
     WHERE sv.service_id = ? AND sv.workshop_id = ?`,
    [id, s.id]
  );
  if (!service) return fail("Service not found", 404);
  const parts = await query(
    `SELECT sp.part_id, p.part_name, p.part_number, sp.quantity_used, sp.price_at_use,
            sp.quantity_used * sp.price_at_use AS line_total
     FROM service_part sp JOIN part p ON p.part_id = sp.part_id
     WHERE sp.service_id = ?`,
    [id]
  );
  const invoice = await queryOne("SELECT * FROM invoice WHERE service_id = ?", [id]);
  let report = null;
  try {
    report = await (await reports()).findOne({ service_id: id }, { projection: { _id: 0 } });
  } catch (e) {
    console.error("MongoDB unavailable:", e);
  }
  return ok({ service, parts, invoice, report });
});

const patch = z.object({ status: z.enum(["In Progress", "Cancelled"]) });

// UPDATE: start work or cancel (only while the service is still open).
export const PATCH = guarded<Ctx>("workshop", async (req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid service", 400);
  const d = patch.parse(await bodyOf(req));
  const r = await execute(
    "UPDATE service SET status = ? WHERE service_id = ? AND workshop_id = ? AND status IN ('Pending', 'In Progress')",
    [d.status, id, s.id]
  );
  return r.affectedRows ? ok({ updated: true }) : fail("Service is already closed or not found", 409);
});

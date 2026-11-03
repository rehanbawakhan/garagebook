import { z } from "zod";
import { execute, query, queryOne } from "@/lib/db";
import { bodyOf, fail, guarded, ok } from "@/lib/http";

const schema = z.object({
  registration_no: z.string().trim().toUpperCase().min(4).max(20),
  description: z.string().trim().min(3).max(255),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export const GET = guarded("workshop", async (_req, s) => {
  const rows = await query(
    `SELECT sv.service_id, sv.service_date, sv.description, sv.status, sv.total_cost,
            v.registration_no, v.make, v.model, o.name AS owner_name,
            i.invoice_id, i.status AS invoice_status
     FROM service sv
     JOIN vehicle v ON v.vehicle_id = sv.vehicle_id
     JOIN owner o ON o.owner_id = v.owner_id
     LEFT JOIN invoice i ON i.service_id = sv.service_id
     WHERE sv.workshop_id = ?
     ORDER BY FIELD(sv.status, 'In Progress', 'Pending', 'Completed', 'Cancelled'), sv.service_date DESC`,
    [s.id]
  );
  return ok(rows);
});

export const POST = guarded("workshop", async (req, s) => {
  const d = schema.parse(await bodyOf(req));
  const v = await queryOne<{ vehicle_id: number }>("SELECT vehicle_id FROM vehicle WHERE registration_no = ?", [d.registration_no]);
  if (!v) return fail("No vehicle with that registration number", 404);
  const r = await execute(
    "INSERT INTO service (vehicle_id, workshop_id, service_date, description, status) VALUES (?, ?, ?, ?, 'Pending')",
    [v.vehicle_id, s.id, d.service_date, d.description]
  );
  return ok({ service_id: r.insertId }, 201);
});

import { z } from "zod";
import { execute, query } from "@/lib/db";
import { bodyOf, guarded, ok } from "@/lib/http";

const schema = z.object({
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  year: z.coerce.number().int().min(1980).max(2100),
  registration_no: z.string().trim().toUpperCase().regex(/^[A-Z0-9 -]{4,20}$/, "Registration number looks invalid"),
  vehicle_type: z.string().trim().min(1).max(30),
});

// Uses the v_vehicle_cost_summary VIEW (which calls fn_vehicle_lifetime_cost).
export const GET = guarded("owner", async (_req, s) => {
  const rows = await query(
    "SELECT * FROM v_vehicle_cost_summary WHERE owner_id = ? ORDER BY vehicle_id",
    [s.id]
  );
  return ok(rows);
});

export const POST = guarded("owner", async (req, s) => {
  const d = schema.parse(await bodyOf(req));
  const r = await execute(
    "INSERT INTO vehicle (owner_id, make, model, year, registration_no, vehicle_type) VALUES (?, ?, ?, ?, ?, ?)",
    [s.id, d.make, d.model, d.year, d.registration_no, d.vehicle_type]
  );
  return ok({ vehicle_id: r.insertId }, 201);
});

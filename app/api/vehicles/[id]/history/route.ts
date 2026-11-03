import { query, queryOne } from "@/lib/db";
import { reports } from "@/lib/mongo";
import { fail, guarded, ok, toId } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// Service history: JOIN service + workshop + invoice, parts per service, and the MongoDB inspection report.
export const GET = guarded<Ctx>("owner", async (_req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid vehicle", 400);
  const mine = await queryOne("SELECT 1 AS x FROM vehicle WHERE vehicle_id = ? AND owner_id = ?", [id, s.id]);
  if (!mine) return fail("Vehicle not found", 404);

  const services = await query<any>(
    `SELECT s.service_id, s.service_date, s.description, s.status, s.total_cost,
            w.name AS workshop_name,
            i.invoice_id, i.status AS invoice_status, i.labor_cost, i.parts_cost, i.tax, i.total_amount
     FROM service s
     JOIN workshop w ON w.workshop_id = s.workshop_id
     LEFT JOIN invoice i ON i.service_id = s.service_id
     WHERE s.vehicle_id = ?
     ORDER BY s.service_date DESC, s.service_id DESC`,
    [id]
  );
  const ids = services.map((x) => x.service_id);
  const parts = ids.length
    ? await query<any>(
        `SELECT sp.service_id, p.part_name, sp.quantity_used, sp.price_at_use
         FROM service_part sp JOIN part p ON p.part_id = sp.part_id
         WHERE sp.service_id IN (?)`,
        [ids]
      )
    : [];
  let reportMap = new Map<number, any>();
  try {
    if (ids.length) {
      const col = await reports();
      const docs = await col.find({ service_id: { $in: ids } }, { projection: { _id: 0 } }).toArray();
      reportMap = new Map(docs.map((d) => [d.service_id, d]));
    }
  } catch (e) {
    console.error("MongoDB unavailable:", e); // SQL history still works without Mongo
  }
  return ok(
    services.map((x) => ({
      ...x,
      parts: parts.filter((p) => p.service_id === x.service_id),
      report: reportMap.get(x.service_id) ?? null,
    }))
  );
});

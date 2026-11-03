import { query } from "@/lib/db";
import { reports } from "@/lib/mongo";
import { guarded, ok } from "@/lib/http";

export const GET = guarded("workshop", async (_req, s) => {
  // SQL side: VIEWS + GROUP BY / HAVING / subquery
  const performance = await query("SELECT * FROM v_workshop_performance ORDER BY total_revenue DESC");
  const lowStock = await query("SELECT * FROM v_low_stock WHERE workshop_id = ? ORDER BY stock_quantity", [s.id]);
  const topParts = await query(
    `SELECT p.part_name, SUM(sp.quantity_used) AS total_used, SUM(sp.quantity_used * sp.price_at_use) AS revenue
     FROM service_part sp
     JOIN service sv ON sv.service_id = sp.service_id
     JOIN part p ON p.part_id = sp.part_id
     WHERE sv.workshop_id = ?
     GROUP BY p.part_id, p.part_name
     HAVING SUM(sp.quantity_used) >= 1
     ORDER BY total_used DESC LIMIT 5`,
    [s.id]
  );
  const aboveAverage = await query(
    `SELECT sv.service_id, sv.description, sv.total_cost
     FROM service sv
     WHERE sv.workshop_id = ? AND sv.status = 'Completed'
       AND sv.total_cost > (SELECT AVG(total_cost) FROM service WHERE status = 'Completed')
     ORDER BY sv.total_cost DESC`,
    [s.id]
  );

  // MongoDB side: aggregation pipelines
  let mongo: any = { available: true };
  try {
    const col = await reports();
    mongo.byVehicleType = await col
      .aggregate([
        { $group: { _id: "$vehicle_type", reports: { $sum: 1 }, avg_condition: { $avg: "$condition_score" } } },
        { $project: { _id: 0, vehicle_type: "$_id", reports: 1, avg_condition: { $round: ["$avg_condition", 1] } } },
        { $sort: { reports: -1 } },
      ])
      .toArray();
    mongo.topIssues = await col
      .aggregate([
        { $match: { workshop_id: s.id } },
        { $unwind: "$issues" },
        { $group: { _id: "$issues", count: { $sum: 1 } } },
        { $project: { _id: 0, issue: "$_id", count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      .toArray();
    mongo.monthly = await col
      .aggregate([
        { $match: { workshop_id: s.id } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } }, reports: { $sum: 1 } } },
        { $project: { _id: 0, month: "$_id", reports: 1 } },
        { $sort: { month: 1 } },
      ])
      .toArray();
  } catch (e) {
    console.error("MongoDB unavailable:", e);
    mongo = { available: false };
  }
  return ok({ performance, lowStock, topParts, aboveAverage, mongo, me: s.id });
});

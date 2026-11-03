import { query } from "@/lib/db";
import { fail, guarded, ok } from "@/lib/http";

// MySQL FULLTEXT search (MATCH ... AGAINST) over repair complaints, ranked by relevance.
// Owners search their own vehicles; workshops search all complaints (anonymised) to find similar past cases.
export const GET = guarded(["owner", "workshop"], async (req, s) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return fail("Type at least 3 characters", 400);
  if (q.length > 200) return fail("Search text is too long", 400);

  if (s.role === "owner") {
    const rows = await query(
      `SELECT rc.complaint_id, rc.complaint_text, rc.complaint_date,
              v.registration_no, v.make, v.model,
              sv.description AS fix_description,
              MATCH(rc.complaint_text) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance
       FROM repair_complaint rc
       JOIN vehicle v ON v.vehicle_id = rc.vehicle_id
       LEFT JOIN service sv ON sv.service_id = rc.service_id
       WHERE v.owner_id = ? AND MATCH(rc.complaint_text) AGAINST (? IN NATURAL LANGUAGE MODE)
       ORDER BY relevance DESC LIMIT 20`,
      [q, s.id, q]
    );
    return ok(rows);
  }
  const rows = await query(
    `SELECT rc.complaint_id, rc.complaint_text, rc.complaint_date,
            v.make, v.model, v.year,
            sv.description AS fix_description,
            MATCH(rc.complaint_text) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance
     FROM repair_complaint rc
     JOIN vehicle v ON v.vehicle_id = rc.vehicle_id
     LEFT JOIN service sv ON sv.service_id = rc.service_id
     WHERE MATCH(rc.complaint_text) AGAINST (? IN NATURAL LANGUAGE MODE)
     ORDER BY relevance DESC LIMIT 20`,
    [q, q]
  );
  return ok(rows);
});

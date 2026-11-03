import { query } from "@/lib/db";
import { guarded, ok } from "@/lib/http";

// Uses the v_expiring_insurance VIEW, plus documents expiring within 30 days.
export const GET = guarded("owner", async (_req, s) => {
  const insurance = await query(
    "SELECT * FROM v_expiring_insurance WHERE owner_id = ? ORDER BY days_left",
    [s.id]
  );
  const documents = await query(
    `SELECT d.document_id, d.doc_type, d.doc_number, d.expiry_date, v.registration_no,
            DATEDIFF(d.expiry_date, CURDATE()) AS days_left
     FROM document d JOIN vehicle v ON v.vehicle_id = d.vehicle_id
     WHERE v.owner_id = ? AND d.expiry_date IS NOT NULL
       AND DATEDIFF(d.expiry_date, CURDATE()) BETWEEN 0 AND 30
     ORDER BY days_left`,
    [s.id]
  );
  return ok({ insurance, documents });
});

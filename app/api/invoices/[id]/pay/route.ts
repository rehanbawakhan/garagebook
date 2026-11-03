import { execute } from "@/lib/db";
import { fail, guarded, ok, toId } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// UPDATE with a JOIN so an owner can only pay invoices for their own vehicles.
export const POST = guarded<Ctx>("owner", async (_req, s, ctx) => {
  const id = toId((await ctx.params).id);
  if (!id) return fail("Invalid invoice", 400);
  const r = await execute(
    `UPDATE invoice i
       JOIN service sv ON sv.service_id = i.service_id
       JOIN vehicle v ON v.vehicle_id = sv.vehicle_id
     SET i.status = 'Paid'
     WHERE i.invoice_id = ? AND v.owner_id = ? AND i.status = 'Unpaid'`,
    [id, s.id]
  );
  return r.affectedRows ? ok({ paid: true }) : fail("No unpaid invoice found", 404);
});

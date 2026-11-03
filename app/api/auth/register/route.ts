import { z } from "zod";
import { query, execute } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { bodyOf, errorResponse, fail, ok } from "@/lib/http";

const base = {
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(120),
  phone: z.string().trim().regex(/^[0-9+\- ]{7,15}$/, "Phone must be 7-15 digits"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
};
const schema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("owner"), ...base }),
  z.object({ role: z.literal("workshop"), ...base, address: z.string().trim().min(5).max(200) }),
]);

export async function POST(req: Request) {
  try {
    const d = schema.parse(await bodyOf(req));
    const hash = await hashPassword(d.password);
    if (d.role === "owner") {
      const dup = await query("SELECT 1 FROM owner WHERE email = ?", [d.email]);
      if (dup.length) return fail("An account with this email already exists", 409);
      const r = await execute(
        "INSERT INTO owner (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        [d.name, d.email, d.phone, hash]
      );
      await createSession({ role: "owner", id: r.insertId, name: d.name });
    } else {
      const dup = await query("SELECT 1 FROM workshop WHERE email = ?", [d.email]);
      if (dup.length) return fail("An account with this email already exists", 409);
      const r = await execute(
        "INSERT INTO workshop (name, email, address, phone, password_hash) VALUES (?, ?, ?, ?, ?)",
        [d.name, d.email, d.address, d.phone, hash]
      );
      await createSession({ role: "workshop", id: r.insertId, name: d.name });
    }
    return ok({ role: d.role }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

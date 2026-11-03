import { z } from "zod";
import { queryOne } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSession, verifyPassword } from "@/lib/auth";
import { bodyOf, errorResponse, fail, ok } from "@/lib/http";

const schema = z.object({
  role: z.enum(["owner", "workshop"]),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(100),
});

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(req: Request) {
  try {
    const d = schema.parse(await bodyOf(req));
    const row =
      d.role === "owner"
        ? await queryOne<{ id: number; name: string; password_hash: string }>(
            "SELECT owner_id AS id, name, password_hash FROM owner WHERE email = ?",
            [d.email]
          )
        : await queryOne<{ id: number; name: string; password_hash: string }>(
            "SELECT workshop_id AS id, name, password_hash FROM workshop WHERE email = ?",
            [d.email]
          );
    const good = await verifyPassword(d.password, row?.password_hash || DUMMY_HASH);
    if (!row || !row.password_hash || !good) return fail("Wrong email or password", 401);
    await createSession({ role: d.role, id: row.id, name: row.name });
    return ok({ role: d.role });
  } catch (e) {
    return errorResponse(e);
  }
}

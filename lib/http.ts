import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession, Role, Session } from "./auth";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Wrap a handler: enforce the role, map validation/database errors to clean JSON. */
export function guarded<C = unknown>(
  roles: Role | Role[],
  handler: (req: Request, session: Session, ctx: C) => Promise<Response>
) {
  return async (req: Request, ctx: C) => {
    const session = await getSession();
    if (!session) return fail("Please log in", 401);
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(session.role)) return fail("You do not have access to this", 403);
    try {
      return await handler(req, session, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: any): Response {
  if (e instanceof ZodError) {
    return fail(e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "), 400);
  }
  if (e?.errno) {
    // MySQL errors: surface database-level validation to the user
    if (e.errno === 1644) return fail(e.sqlMessage, 409); // SIGNAL from trigger / procedure
    if (e.errno === 1062) return fail("That value already exists", 409);
    if (e.errno === 3819 || e.errno === 4025) return fail("A database check constraint rejected this data", 400);
    if (e.errno === 1452) return fail("Referenced record does not exist", 400);
    if (e.errno === 1451) return fail("Cannot delete: other records depend on this", 409);
    if (e.errno === 1265 || e.errno === 1366 || e.errno === 1292) return fail("Invalid value for a field", 400);
  }
  console.error(e);
  return fail("Something went wrong on the server", 500);
}

export async function bodyOf(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export const toId = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : NaN;
};

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

export type Role = "owner" | "workshop";
export interface Session {
  role: Role;
  id: number;
  name: string;
}

const COOKIE = "gb_session";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET must be set (16+ characters) in .env.local");
  return new TextEncoder().encode(s);
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function createSession(s: Session) {
  const token = await new SignJWT({ role: s.role, id: s.id, name: s.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    if ((payload.role !== "owner" && payload.role !== "workshop") || typeof payload.id !== "number") return null;
    return { role: payload.role, id: payload.id, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

/** For pages: redirect to /login unless the visitor has the given role. */
export async function requirePageRole(role: Role): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== role) redirect(s.role === "owner" ? "/owner" : "/workshop");
  return s;
}

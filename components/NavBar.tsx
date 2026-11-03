"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function NavBar({ role, name }: { role: "owner" | "workshop"; name: string }) {
  const router = useRouter();
  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: {} });
    router.push("/login");
    router.refresh();
  }
  return (
    <nav className="nav">
      <Link href={role === "owner" ? "/owner" : "/workshop"} className="brand">GarageBook</Link>
      {role === "owner" ? (
        <Link href="/owner">My vehicles</Link>
      ) : (
        <>
          <Link href="/workshop">Services</Link>
          <Link href="/workshop/inventory">Inventory</Link>
          <Link href="/workshop/analytics">Analytics</Link>
        </>
      )}
      <span className="spacer" />
      <span className="who">{name} ({role})</span>
      <button className="ghost" onClick={logout}>Log out</button>
    </nav>
  );
}

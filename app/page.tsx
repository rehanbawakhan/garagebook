import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  if (s) redirect(s.role === "owner" ? "/owner" : "/workshop");
  return (
    <div className="hero">
      <h1>GarageBook</h1>
      <p className="muted">
        One place for every vehicle you own: service history, parts, expenses, insurance and invoices.
        Workshops record the work and generate the invoice.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
        <Link href="/login"><button>Log in</button></Link>
        <Link href="/register"><button className="ghost">Create account</button></Link>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import Msg from "@/components/Msg";

export default function Register() {
  const router = useRouter();
  const [role, setRole] = useState<"owner" | "workshop">("owner");
  const [f, setF] = useState({ name: "", email: "", phone: "", address: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: any = { role, name: f.name, email: f.email, phone: f.phone, password: f.password };
      if (role === "workshop") body.address = f.address;
      await api("/api/auth/register", { body });
      router.push(role === "owner" ? "/owner" : "/workshop");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center card">
      <h1>Create account</h1>
      <form onSubmit={submit} className="grid">
        <div className="tabs">
          <button type="button" className={role === "owner" ? "on" : ""} onClick={() => setRole("owner")}>Vehicle owner</button>
          <button type="button" className={role === "workshop" ? "on" : ""} onClick={() => setRole("workshop")}>Workshop</button>
        </div>
        <label>{role === "owner" ? "Your name" : "Workshop name"}<input value={f.name} onChange={set("name")} required /></label>
        <label>Email<input type="email" value={f.email} onChange={set("email")} required /></label>
        <label>Phone<input value={f.phone} onChange={set("phone")} required /></label>
        {role === "workshop" && <label>Address<input value={f.address} onChange={set("address")} required /></label>}
        <label>Password (min 8 characters)<input type="password" value={f.password} onChange={set("password")} required minLength={8} /></label>
        <Msg error={error} />
        <button disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
        <span className="muted">Already registered? <Link href="/login">Log in</Link></span>
      </form>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import Msg from "@/components/Msg";

export default function Login() {
  const router = useRouter();
  const [role, setRole] = useState<"owner" | "workshop">("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { body: { role, email, password } });
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
      <h1>Log in</h1>
      <form onSubmit={submit} className="grid">
        <div className="tabs">
          <button type="button" className={role === "owner" ? "on" : ""} onClick={() => setRole("owner")}>Vehicle owner</button>
          <button type="button" className={role === "workshop" ? "on" : ""} onClick={() => setRole("workshop")}>Workshop</button>
        </div>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <Msg error={error} />
        <button disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
        <span className="muted">No account? <Link href="/register">Create one</Link></span>
      </form>
    </div>
  );
}

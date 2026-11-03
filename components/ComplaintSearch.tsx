"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import Msg from "./Msg";

export default function ComplaintSearch({ role }: { role: "owner" | "workshop" }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setRows(await api(`/api/complaints/search?q=${encodeURIComponent(q)}`));
    } catch (err: any) {
      setError(err.message);
      setRows(null);
    }
  }

  return (
    <div className="card">
      <h2>{role === "owner" ? "Search my repair complaints" : "Find similar past complaints"}</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Full-text search ranked by relevance, e.g. “brake noise” or “engine knocking”.
      </p>
      <form onSubmit={search} className="row">
        <label>Describe the problem<input value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }} required /></label>
        <button>Search</button>
      </form>
      <Msg error={error} />
      {rows && rows.length === 0 && <div className="empty">No matching complaints.</div>}
      {rows && rows.length > 0 && (
        <table>
          <thead>
            <tr><th>Complaint</th><th>Vehicle</th><th>Fixed by</th><th>Match</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.complaint_id}>
                <td>{r.complaint_text}<div className="muted">{r.complaint_date}</div></td>
                <td>{r.registration_no ? `${r.registration_no} · ` : ""}{r.make} {r.model}{r.year ? ` (${r.year})` : ""}</td>
                <td>{r.fix_description ?? <span className="muted">not yet linked to a service</span>}</td>
                <td>{Number(r.relevance).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

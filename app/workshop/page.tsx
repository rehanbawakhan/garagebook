"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, inr, today } from "@/lib/client";
import Msg from "@/components/Msg";
import ComplaintSearch from "@/components/ComplaintSearch";

const badge = (s: string) => (s === "Completed" ? "ok" : s === "Cancelled" ? "bad" : s === "In Progress" ? "" : "warn");

export default function WorkshopHome() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ registration_no: "", description: "", service_date: today() });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api("/api/workshop/services"));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/workshop/services", { body: f });
      setF({ registration_no: "", description: "", service_date: today() });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const open = rows.filter((r) => r.status === "Pending" || r.status === "In Progress").length;

  return (
    <>
      <h1>Workshop services</h1>
      <Msg error={error} />
      <div className="card">
        <h2>Book a vehicle in</h2>
        <form onSubmit={create} className="row">
          <label>Registration no<input value={f.registration_no} onChange={(e) => setF({ ...f, registration_no: e.target.value })} required /></label>
          <label>Work to do<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ minWidth: 280 }} required /></label>
          <label>Date<input type="date" value={f.service_date} onChange={(e) => setF({ ...f, service_date: e.target.value })} required /></label>
          <button>Create service</button>
        </form>
      </div>

      <div className="card">
        <h2>All services <span className="muted">({open} open)</span></h2>
        {rows.length === 0 ? (
          <div className="empty">No services yet.</div>
        ) : (
          <table>
            <thead><tr><th>#</th><th>Date</th><th>Vehicle</th><th>Owner</th><th>Work</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.service_id}>
                  <td><Link href={`/workshop/services/${r.service_id}`}>#{r.service_id}</Link></td>
                  <td>{r.service_date}</td>
                  <td>{r.registration_no}<div className="muted">{r.make} {r.model}</div></td>
                  <td>{r.owner_name}</td>
                  <td>{r.description}</td>
                  <td><span className={`badge ${badge(r.status)}`}>{r.status}</span></td>
                  <td>{r.invoice_id ? inr(r.total_cost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ComplaintSearch role="workshop" />
    </>
  );
}

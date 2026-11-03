"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, inr } from "@/lib/client";
import { checksFor } from "@/lib/checks";
import Msg from "@/components/Msg";

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [good, setGood] = useState("");
  const [part, setPart] = useState({ part_id: "", quantity_used: "1" });
  const [bill, setBill] = useState({ labor_cost: "", tax_rate: "18" });
  const [rep, setRep] = useState<any>({ condition_score: "7", issues: "", notes: "", checks: {} });

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/workshop/services/${id}`);
      setData(d);
      setInventory(await api("/api/workshop/inventory"));
      if (d.report) {
        setRep({
          condition_score: String(d.report.condition_score),
          issues: (d.report.issues ?? []).join(", "),
          notes: d.report.notes ?? "",
          checks: d.report.checks ?? {},
        });
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<any>, success: string) {
    setError(""); setGood("");
    try {
      await fn();
      setGood(success);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!data) return <><Msg error={error} /><div className="muted">Loading...</div></>;
  const { service, parts, invoice, report } = data;
  const closed = service.status === "Completed" || service.status === "Cancelled";
  const partsTotal = parts.reduce((n: number, p: any) => n + Number(p.line_total), 0);
  const fields = checksFor(service.vehicle_type);

  return (
    <>
      <p><Link href="/workshop">← All services</Link></p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>Service #{service.service_id} <span className="muted">· {service.registration_no} · {service.make} {service.model} ({service.vehicle_type})</span></h1>
        <span className={`badge ${service.status === "Completed" ? "ok" : service.status === "Cancelled" ? "bad" : "warn"}`}>{service.status}</span>
      </div>
      <div className="muted" style={{ marginBottom: 12 }}>{service.description} · {service.service_date} · Owner: {service.owner_name}</div>
      <Msg error={error} good={good} />

      {!closed && (
        <div className="row" style={{ marginBottom: 12 }}>
          {service.status === "Pending" && (
            <button className="ghost" onClick={() => run(() => api(`/api/workshop/services/${id}`, { method: "PATCH", body: { status: "In Progress" } }), "Work started")}>Start work</button>
          )}
          <button className="danger" onClick={() => confirm("Cancel this service?") && run(() => api(`/api/workshop/services/${id}`, { method: "PATCH", body: { status: "Cancelled" } }), "Service cancelled")}>Cancel service</button>
        </div>
      )}

      <div className="card">
        <h2>Parts used</h2>
        {parts.length === 0 ? <div className="empty">No parts added.</div> : (
          <table>
            <thead><tr><th>Part</th><th>Qty</th><th>Price</th><th>Line total</th><th /></tr></thead>
            <tbody>
              {parts.map((p: any) => (
                <tr key={p.part_id}>
                  <td>{p.part_name} <span className="muted">{p.part_number}</span></td>
                  <td>{p.quantity_used}</td><td>{inr(p.price_at_use)}</td><td>{inr(p.line_total)}</td>
                  <td>{!closed && <button className="danger" onClick={() => run(() => api(`/api/workshop/services/${id}/parts?part_id=${p.part_id}`, { method: "DELETE" }), "Part removed and returned to stock")}>Remove</button>}</td>
                </tr>
              ))}
              <tr><td colSpan={3}><b>Parts total</b></td><td colSpan={2}><b>{inr(partsTotal)}</b></td></tr>
            </tbody>
          </table>
        )}
        {!closed && (
          <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); run(() => api(`/api/workshop/services/${id}/parts`, { body: part }), "Part added, stock deducted"); }}>
            <label>Part
              <select value={part.part_id} onChange={(e) => setPart({ ...part, part_id: e.target.value })} required>
                <option value="">Choose...</option>
                {inventory.map((i) => <option key={i.part_id} value={i.part_id}>{i.part_name} — {inr(i.unit_price)} ({i.stock_quantity} in stock)</option>)}
              </select>
            </label>
            <label>Quantity<input type="number" min={1} value={part.quantity_used} onChange={(e) => setPart({ ...part, quantity_used: e.target.value })} /></label>
            <button>Add part</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Inspection report <span className="muted">(stored in MongoDB)</span></h2>
        <form className="grid" onSubmit={(e) => {
          e.preventDefault();
          run(() => api(`/api/workshop/services/${id}/report`, {
            body: {
              condition_score: rep.condition_score,
              issues: rep.issues.split(",").map((s: string) => s.trim()).filter(Boolean),
              notes: rep.notes,
              checks: rep.checks,
            },
          }), "Report saved");
        }}>
          <div className="row">
            {fields.map((c) => (
              <label key={c.name}>{c.label}
                {c.type === "select" ? (
                  <select value={String(rep.checks[c.name] ?? "")} onChange={(e) => setRep({ ...rep, checks: { ...rep.checks, [c.name]: e.target.value } })}>
                    <option value="">—</option>
                    {c.options!.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : c.type === "boolean" ? (
                  <select value={String(rep.checks[c.name] ?? "")} onChange={(e) => setRep({ ...rep, checks: { ...rep.checks, [c.name]: e.target.value === "" ? "" : e.target.value === "true" } })}>
                    <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                  </select>
                ) : (
                  <input type="number" step="0.1" value={String(rep.checks[c.name] ?? "")} onChange={(e) => setRep({ ...rep, checks: { ...rep.checks, [c.name]: e.target.value === "" ? "" : Number(e.target.value) } })} />
                )}
              </label>
            ))}
          </div>
          <div className="row">
            <label>Condition (1-10)<input type="number" min={1} max={10} value={rep.condition_score} onChange={(e) => setRep({ ...rep, condition_score: e.target.value })} required /></label>
            <label>Issues found (comma separated)<input value={rep.issues} onChange={(e) => setRep({ ...rep, issues: e.target.value })} style={{ minWidth: 300 }} /></label>
            <label>Notes<input value={rep.notes} onChange={(e) => setRep({ ...rep, notes: e.target.value })} style={{ minWidth: 300 }} /></label>
            <button>{report ? "Update report" : "Save report"}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Invoice</h2>
        {invoice ? (
          <div>
            Invoice #{invoice.invoice_id} · {invoice.invoice_date}<br />
            Labour {inr(invoice.labor_cost)} + parts {inr(invoice.parts_cost)} + tax {inr(invoice.tax)} = <b>{inr(invoice.total_amount)}</b>{" "}
            <span className={`badge ${invoice.status === "Paid" ? "ok" : "warn"}`}>{invoice.status}</span>
          </div>
        ) : closed ? (
          <div className="empty">This service was cancelled, so there is no invoice.</div>
        ) : (
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (confirm("Generate the invoice and close this service?")) run(() => api(`/api/workshop/services/${id}/invoice`, { body: bill }), "Invoice generated, service completed"); }}>
            <label>Labour cost (₹)<input type="number" min={0} step="0.01" value={bill.labor_cost} onChange={(e) => setBill({ ...bill, labor_cost: e.target.value })} required /></label>
            <label>Tax rate (%)<input type="number" min={0} max={100} step="0.01" value={bill.tax_rate} onChange={(e) => setBill({ ...bill, tax_rate: e.target.value })} required /></label>
            <button>Generate invoice</button>
            <span className="muted">Parts so far: {inr(partsTotal)}</span>
          </form>
        )}
      </div>
    </>
  );
}

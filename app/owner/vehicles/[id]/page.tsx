"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, inr } from "@/lib/client";
import { RECORD_KINDS } from "@/lib/records";
import RecordsPanel from "@/components/RecordsPanel";
import Msg from "@/components/Msg";

export default function VehiclePage() {
  const { id } = useParams<{ id: string }>();
  const vehicleId = Number(id);
  const router = useRouter();
  const [v, setV] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [tab, setTab] = useState("expenses");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setV(await api(`/api/vehicles/${vehicleId}`));
      setHistory(await api(`/api/vehicles/${vehicleId}/history`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [vehicleId]);
  useEffect(() => { load(); }, [load]);

  async function pay(invoiceId: number) {
    if (!confirm("Mark this invoice as paid?")) return;
    try {
      await api(`/api/invoices/${invoiceId}/pay`, { method: "POST", body: {} });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeVehicle() {
    if (!confirm("Delete this vehicle and ALL its records?")) return;
    try {
      await api(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
      router.push("/owner");
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!v) return <><Msg error={error} /><div className="muted">Loading...</div></>;

  return (
    <>
      <p><Link href="/owner">← All vehicles</Link></p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>{v.make} {v.model} <span className="muted">({v.year}) · {v.registration_no}</span></h1>
        <button className="danger" onClick={removeVehicle}>Delete vehicle</button>
      </div>
      <Msg error={error} />

      <div className="grid two">
        <div className="card"><div className="muted">Expenses</div><div className="stat">{inr(v.total_expenses)}</div></div>
        <div className="card"><div className="muted">Fuel</div><div className="stat">{inr(v.total_fuel)}</div></div>
        <div className="card"><div className="muted">Completed services</div><div className="stat">{inr(v.total_service)}</div></div>
        <div className="card"><div className="muted">Lifetime cost</div><div className="stat">{inr(v.lifetime_cost)}</div></div>
      </div>

      <div className="card">
        <h2>Service history</h2>
        {history.length === 0 && <div className="empty">No services recorded by a workshop yet.</div>}
        {history.map((s) => (
          <div key={s.service_id} className="card" style={{ background: "#fafbfd" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <b>{s.description}</b>
                <div className="muted">{s.service_date} · {s.workshop_name}</div>
              </div>
              <span className={`badge ${s.status === "Completed" ? "ok" : s.status === "Cancelled" ? "bad" : "warn"}`}>{s.status}</span>
            </div>
            {s.parts.length > 0 && (
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Part</th><th>Qty</th><th>Price at use</th></tr></thead>
                <tbody>
                  {s.parts.map((p: any) => (
                    <tr key={p.part_name}><td>{p.part_name}</td><td>{p.quantity_used}</td><td>{inr(p.price_at_use)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {s.invoice_id && (
              <div className="row" style={{ marginTop: 8, alignItems: "center" }}>
                <span>Invoice #{s.invoice_id}: labour {inr(s.labor_cost)} + parts {inr(s.parts_cost)} + tax {inr(s.tax)} = <b>{inr(s.total_amount)}</b></span>
                <span className={`badge ${s.invoice_status === "Paid" ? "ok" : "warn"}`}>{s.invoice_status}</span>
                {s.invoice_status === "Unpaid" && <button onClick={() => pay(s.invoice_id)}>Mark paid</button>}
              </div>
            )}
            {s.report && (
              <div style={{ marginTop: 8 }} className="muted">
                Inspection score <b>{s.report.condition_score}/10</b>
                {s.report.issues?.length > 0 && <> · issues: {s.report.issues.join(", ")}</>}
                {s.report.notes && <> · “{s.report.notes}”</>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="tabs">
          {Object.entries(RECORD_KINDS).map(([k, kind]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{kind.label}</button>
          ))}
        </div>
        <RecordsPanel vehicleId={vehicleId} kindKey={tab} onChange={load} />
      </div>
    </>
  );
}

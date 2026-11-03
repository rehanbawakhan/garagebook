"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, inr } from "@/lib/client";
import Msg from "@/components/Msg";
import ComplaintSearch from "@/components/ComplaintSearch";

export default function OwnerHome() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ insurance: any[]; documents: any[] }>({ insurance: [], documents: [] });
  const [f, setF] = useState({ make: "", model: "", year: "", registration_no: "", vehicle_type: "Car" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setVehicles(await api("/api/vehicles"));
      setAlerts(await api("/api/owner/alerts"));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/vehicles", { body: f });
      setF({ make: "", model: "", year: "", registration_no: "", vehicle_type: "Car" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const total = vehicles.reduce((n, v) => n + Number(v.lifetime_cost), 0);
  const alertCount = alerts.insurance.length + alerts.documents.length;

  return (
    <>
      <h1>My garage</h1>
      <Msg error={error} />

      {alertCount > 0 && (
        <div className="card">
          <h2>Expiring within 30 days</h2>
          {alerts.insurance.map((a) => (
            <div key={`i${a.insurance_id}`}><span className="badge warn">Insurance</span> {a.registration_no} · {a.provider} ends {a.end_date} ({a.days_left} days)</div>
          ))}
          {alerts.documents.map((d) => (
            <div key={`d${d.document_id}`}><span className="badge warn">{d.doc_type}</span> {d.registration_no} expires {d.expiry_date} ({d.days_left} days)</div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Vehicles ({vehicles.length})</h2>
          <div className="muted">Lifetime cost across all vehicles: <b>{inr(total)}</b></div>
        </div>
        {vehicles.length === 0 ? (
          <div className="empty">No vehicles yet. Add your first one below.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Vehicle</th><th>Reg. no</th><th>Type</th><th>Expenses</th><th>Fuel</th><th>Services</th><th>Lifetime</th></tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.vehicle_id}>
                  <td><Link href={`/owner/vehicles/${v.vehicle_id}`}>{v.make} {v.model} ({v.year})</Link></td>
                  <td>{v.registration_no}</td>
                  <td>{v.vehicle_type}</td>
                  <td>{inr(v.total_expenses)}</td>
                  <td>{inr(v.total_fuel)}</td>
                  <td>{inr(v.total_service)}</td>
                  <td><b>{inr(v.lifetime_cost)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Add a vehicle</h2>
        <form onSubmit={add} className="row">
          <label>Make<input value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} required /></label>
          <label>Model<input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} required /></label>
          <label>Year<input type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} required /></label>
          <label>Registration no<input value={f.registration_no} onChange={(e) => setF({ ...f, registration_no: e.target.value })} required /></label>
          <label>Type
            <select value={f.vehicle_type} onChange={(e) => setF({ ...f, vehicle_type: e.target.value })}>
              <option>Car</option><option>Bike</option><option>Truck</option><option>Other</option>
            </select>
          </label>
          <button>Add vehicle</button>
        </form>
      </div>

      <ComplaintSearch role="owner" />
    </>
  );
}

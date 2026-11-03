"use client";
import { useEffect, useState } from "react";
import { api, inr } from "@/lib/client";
import Msg from "@/components/Msg";

export default function Analytics() {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/workshop/analytics").then(setD).catch((e) => setError(e.message));
  }, []);
  if (!d) return <><Msg error={error} /><div className="muted">Loading...</div></>;
  const m = d.mongo;

  return (
    <>
      <h1>Analytics</h1>

      <div className="card">
        <h2>Workshop comparison <span className="muted">(SQL view: v_workshop_performance)</span></h2>
        <table>
          <thead><tr><th>Workshop</th><th>Rating</th><th>Services done</th><th>Avg cost</th><th>Avg turnaround (days)</th><th>Revenue</th></tr></thead>
          <tbody>
            {d.performance.map((w: any) => (
              <tr key={w.workshop_id} style={w.workshop_id === d.me ? { background: "#f0f5ff" } : undefined}>
                <td>{w.name}{w.workshop_id === d.me && " (you)"}</td><td>{w.rating}</td><td>{w.services_completed}</td>
                <td>{inr(w.avg_service_cost)}</td><td>{w.avg_turnaround_days}</td><td>{inr(w.total_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Low stock <span className="muted">(view: v_low_stock)</span></h2>
          {d.lowStock.length === 0 ? <div className="empty">Everything is above its reorder level.</div> : (
            <table><thead><tr><th>Part</th><th>Left</th><th>Reorder at</th></tr></thead>
              <tbody>{d.lowStock.map((r: any) => <tr key={r.part_id}><td>{r.part_name}</td><td>{r.stock_quantity}</td><td>{r.reorder_level}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card">
          <h2>Most used parts <span className="muted">(GROUP BY + HAVING)</span></h2>
          {d.topParts.length === 0 ? <div className="empty">No parts used yet.</div> : (
            <table><thead><tr><th>Part</th><th>Used</th><th>Revenue</th></tr></thead>
              <tbody>{d.topParts.map((r: any) => <tr key={r.part_name}><td>{r.part_name}</td><td>{r.total_used}</td><td>{inr(r.revenue)}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Your services costing more than the all-workshop average <span className="muted">(subquery)</span></h2>
        {d.aboveAverage.length === 0 ? <div className="empty">None.</div> : (
          <table><thead><tr><th>#</th><th>Work</th><th>Total</th></tr></thead>
            <tbody>{d.aboveAverage.map((r: any) => <tr key={r.service_id}><td>#{r.service_id}</td><td>{r.description}</td><td>{inr(r.total_cost)}</td></tr>)}</tbody></table>
        )}
      </div>

      <h2>Inspection reports <span className="muted">(MongoDB aggregation pipelines)</span></h2>
      {!m.available ? (
        <div className="card"><Msg error="MongoDB is not reachable. Start it and refresh - the SQL analytics above still work." /></div>
      ) : (
        <div className="grid two">
          <div className="card">
            <h2>Average condition by vehicle type</h2>
            {m.byVehicleType.length === 0 ? <div className="empty">No reports yet.</div> : (
              <table><thead><tr><th>Type</th><th>Reports</th><th>Avg score</th></tr></thead>
                <tbody>{m.byVehicleType.map((r: any) => <tr key={r.vehicle_type}><td>{r.vehicle_type}</td><td>{r.reports}</td><td>{r.avg_condition}</td></tr>)}</tbody></table>
            )}
          </div>
          <div className="card">
            <h2>Your most common issues</h2>
            {m.topIssues.length === 0 ? <div className="empty">No issues recorded.</div> : (
              <table><thead><tr><th>Issue</th><th>Times</th></tr></thead>
                <tbody>{m.topIssues.map((r: any) => <tr key={r.issue}><td>{r.issue}</td><td>{r.count}</td></tr>)}</tbody></table>
            )}
          </div>
          <div className="card">
            <h2>Reports per month</h2>
            {m.monthly.length === 0 ? <div className="empty">No reports yet.</div> : (
              <table><thead><tr><th>Month</th><th>Reports</th></tr></thead>
                <tbody>{m.monthly.map((r: any) => <tr key={r.month}><td>{r.month}</td><td>{r.reports}</td></tr>)}</tbody></table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

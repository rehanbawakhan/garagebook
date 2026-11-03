"use client";
import { useCallback, useEffect, useState } from "react";
import { api, inr } from "@/lib/client";
import Msg from "@/components/Msg";

export default function Inventory() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ part_number: "", part_name: "", category: "", add_quantity: "", unit_price: "", reorder_level: "3" });
  const [error, setError] = useState("");
  const [good, setGood] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api("/api/workshop/inventory"));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setGood("");
    try {
      await api("/api/workshop/inventory", { body: f });
      setGood("Stock saved");
      setF({ part_number: "", part_name: "", category: "", add_quantity: "", unit_price: "", reorder_level: "3" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <h1>Inventory</h1>
      <Msg error={error} good={good} />
      <div className="card">
        <h2>Add stock</h2>
        <p className="muted" style={{ marginTop: -6 }}>Use an existing part number to add to its stock; a new part number creates the part. Runs as one transaction.</p>
        <form onSubmit={save} className="row">
          <label>Part number<input value={f.part_number} onChange={set("part_number")} required /></label>
          <label>Part name<input value={f.part_name} onChange={set("part_name")} required /></label>
          <label>Category<input value={f.category} onChange={set("category")} /></label>
          <label>Quantity to add<input type="number" min={0} value={f.add_quantity} onChange={set("add_quantity")} required /></label>
          <label>Unit price (₹)<input type="number" min={0} step="0.01" value={f.unit_price} onChange={set("unit_price")} required /></label>
          <label>Reorder level<input type="number" min={0} value={f.reorder_level} onChange={set("reorder_level")} /></label>
          <button>Save</button>
        </form>
      </div>
      <div className="card">
        <h2>Current stock</h2>
        {rows.length === 0 ? <div className="empty">Nothing in stock yet.</div> : (
          <table>
            <thead><tr><th>Part</th><th>Number</th><th>Category</th><th>In stock</th><th>Unit price</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.part_id}>
                  <td>{r.part_name}</td><td>{r.part_number}</td><td>{r.category ?? "—"}</td>
                  <td>{r.stock_quantity}</td><td>{inr(r.unit_price)}</td>
                  <td>{r.stock_quantity <= r.reorder_level && <span className="badge bad">Low stock</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

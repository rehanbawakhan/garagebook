"use client";
import { useCallback, useEffect, useState } from "react";
import { api, today } from "@/lib/client";
import { RECORD_KINDS } from "@/lib/records";
import Msg from "./Msg";

export default function RecordsPanel({ vehicleId, kindKey, onChange }: { vehicleId: number; kindKey: string; onChange?: () => void }) {
  const kind = RECORD_KINDS[kindKey];
  const url = `/api/vehicles/${vehicleId}/records/${kindKey}`;
  const blank = () =>
    Object.fromEntries(kind.fields.map((f) => [f.name, f.type === "date" ? today() : f.type === "select" ? f.options![0] : ""]));
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>(blank());
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api(url));
    } catch (e: any) {
      setError(e.message);
    }
  }, [url]);

  useEffect(() => {
    setForm(blank());
    setError("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindKey, vehicleId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(url, { body: form });
      setForm(blank());
      await load();
      onChange?.();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this record?")) return;
    setError("");
    try {
      await api(`${url}?rid=${id}`, { method: "DELETE" });
      await load();
      onChange?.();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <form onSubmit={add} className="row" style={{ marginBottom: 12 }}>
        {kind.fields.map((f) => (
          <label key={f.name}>
            {f.label}{f.required ? " *" : ""}
            {f.type === "select" ? (
              <select value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                {f.options!.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} required={f.required} rows={2} />
            ) : (
              <input
                type={f.type}
                step={f.step}
                value={form[f.name]}
                required={f.required}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              />
            )}
          </label>
        ))}
        <button>Add</button>
      </form>
      <Msg error={error} />
      {rows.length === 0 ? (
        <div className="empty">No {kind.label.toLowerCase()} yet.</div>
      ) : (
        <table>
          <thead>
            <tr>{kind.fields.map((f) => <th key={f.name}>{f.label}</th>)}<th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[kind.pk]}>
                {kind.fields.map((f) => <td key={f.name}>{r[f.name] ?? "—"}</td>)}
                <td><button className="danger" onClick={() => remove(r[kind.pk])}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

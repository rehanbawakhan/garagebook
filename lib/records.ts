import { z } from "zod";

// One config drives both the owner's record panels (UI) and the generic record API (validation + SQL).
// Table/column names come ONLY from this whitelist, never from user input.

export type FieldType = "text" | "number" | "date" | "select" | "textarea";
export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  step?: string;
}
export interface RecordKind {
  label: string;
  table: string;
  pk: string;
  orderBy: string;
  fields: Field[];
}

export const RECORD_KINDS: Record<string, RecordKind> = {
  expenses: {
    label: "Expenses",
    table: "expense",
    pk: "expense_id",
    orderBy: "expense_date DESC, expense_id DESC",
    fields: [
      { name: "expense_type", label: "Type", type: "select", required: true, options: ["Fuel", "Parking", "Toll", "Wash", "Accessories", "Other"] },
      { name: "amount", label: "Amount (₹)", type: "number", required: true, step: "0.01" },
      { name: "expense_date", label: "Date", type: "date", required: true },
      { name: "description", label: "Description", type: "text" },
    ],
  },
  fuel: {
    label: "Fuel log",
    table: "fuel_log",
    pk: "fuel_id",
    orderBy: "fuel_date DESC, fuel_id DESC",
    fields: [
      { name: "fuel_date", label: "Date", type: "date", required: true },
      { name: "liters", label: "Litres", type: "number", required: true, step: "0.01" },
      { name: "cost", label: "Cost (₹)", type: "number", required: true, step: "0.01" },
      { name: "odometer_reading", label: "Odometer (km)", type: "number", step: "1" },
    ],
  },
  insurance: {
    label: "Insurance",
    table: "insurance",
    pk: "insurance_id",
    orderBy: "end_date DESC",
    fields: [
      { name: "provider", label: "Provider", type: "text", required: true },
      { name: "policy_number", label: "Policy no.", type: "text", required: true },
      { name: "start_date", label: "Start", type: "date", required: true },
      { name: "end_date", label: "End", type: "date", required: true },
      { name: "premium_amount", label: "Premium (₹)", type: "number", step: "0.01" },
      { name: "coverage_type", label: "Coverage", type: "text" },
    ],
  },
  documents: {
    label: "Documents",
    table: "document",
    pk: "document_id",
    orderBy: "expiry_date DESC, document_id DESC",
    fields: [
      { name: "doc_type", label: "Type", type: "select", required: true, options: ["RC", "PUC", "Driving licence", "Permit", "Invoice copy", "Other"] },
      { name: "doc_number", label: "Number", type: "text", required: true },
      { name: "issue_date", label: "Issued", type: "date", required: true },
      { name: "expiry_date", label: "Expires", type: "date" },
    ],
  },
  tyres: {
    label: "Tyres",
    table: "tyre",
    pk: "tyre_id",
    orderBy: "install_date DESC, tyre_id DESC",
    fields: [
      { name: "brand", label: "Brand", type: "text", required: true },
      { name: "position", label: "Position", type: "select", required: true, options: ["Front-Left", "Front-Right", "Rear-Left", "Rear-Right"] },
      { name: "install_date", label: "Installed", type: "date", required: true },
      { name: "expected_life_km", label: "Expected life (km)", type: "number", step: "1" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Worn", "Replaced"] },
    ],
  },
  complaints: {
    label: "Complaints",
    table: "repair_complaint",
    pk: "complaint_id",
    orderBy: "complaint_date DESC, complaint_id DESC",
    fields: [
      { name: "complaint_text", label: "What is wrong?", type: "textarea", required: true },
      { name: "complaint_date", label: "Date", type: "date", required: true },
    ],
  },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Build a zod schema for one record kind. Empty optional fields become null. */
export function buildSchema(kind: RecordKind) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of kind.fields) {
    let t: z.ZodTypeAny;
    switch (f.type) {
      case "number":
        t = z.coerce.number({ invalid_type_error: `${f.label} must be a number` });
        break;
      case "date":
        t = z.string().regex(DATE, `${f.label} must be a date`);
        break;
      case "select":
        t = z.enum(f.options as [string, ...string[]]);
        break;
      default:
        t = z.string().trim().min(1, `${f.label} is required`).max(500);
    }
    if (!f.required) {
      const inner = t;
      t = z.preprocess((v) => (v === "" || v === undefined ? null : v), inner.nullable());
    }
    shape[f.name] = t;
  }
  return z.object(shape);
}

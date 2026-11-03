// Inspection checklist fields differ by vehicle type. MongoDB stores them as a flexible
// sub-document, so adding a new vehicle type needs no schema change.
export interface CheckField {
  name: string;
  label: string;
  type: "number" | "select" | "boolean";
  options?: string[];
}

const COMMON: CheckField[] = [{ name: "battery_voltage", label: "Battery voltage (V)", type: "number" }];

export const CHECKS_BY_TYPE: Record<string, CheckField[]> = {
  Car: [
    { name: "brake_pad_mm", label: "Brake pad (mm)", type: "number" },
    { name: "tyre_tread_mm", label: "Tyre tread (mm)", type: "number" },
    { name: "oil_level", label: "Oil level", type: "select", options: ["Low", "OK", "Full"] },
    { name: "ac_working", label: "AC working", type: "boolean" },
    ...COMMON,
  ],
  Bike: [
    { name: "chain_slack_mm", label: "Chain slack (mm)", type: "number" },
    { name: "sprocket_wear", label: "Sprocket wear", type: "select", options: ["None", "Moderate", "Severe"] },
    { name: "brake_shoe_mm", label: "Brake shoe (mm)", type: "number" },
    ...COMMON,
  ],
};

export function checksFor(vehicleType: string): CheckField[] {
  return CHECKS_BY_TYPE[vehicleType] ?? COMMON;
}

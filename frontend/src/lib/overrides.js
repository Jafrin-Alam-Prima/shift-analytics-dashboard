// Manual per-row corrections, applied ON TOP of the auto-clean pipeline.
// Shape: { [rowIndex]: { fields?: {date,start,end,hours,reason}, excluded?: true } }
// They are applied to the logical rows (each tagged with its original __id) before
// the canonical cleaning runs again — so with no overrides the result is identical.
import { LOGICAL_FIELDS } from "./config.js";

export function defaultOverrides() {
  return {};
}

// produce the effective logical rows: field overrides applied, excluded rows
// dropped, every row tagged with its original index so cleaning keeps row numbers.
export function applyOverrides(logical, overrides) {
  const out = [];
  logical.forEach((row, i) => {
    const ov = overrides[i];
    if (ov && ov.excluded) return;
    out.push({ ...row, ...(ov && ov.fields ? ov.fields : {}), __id: i });
  });
  return out;
}

// how many individual corrections are active (each field change + each exclude)
export function overrideCount(overrides) {
  let n = 0;
  for (const k of Object.keys(overrides)) {
    const ov = overrides[k];
    if (ov.fields) n += Object.keys(ov.fields).length;
    if (ov.excluded) n += 1;
  }
  return n;
}

// an auditable list of every correction: {row, field, from, to, action}
export function overrideAudit(logical, overrides) {
  const list = [];
  for (const k of Object.keys(overrides)) {
    const i = Number(k);
    const ov = overrides[k];
    if (ov.fields) {
      for (const f of LOGICAL_FIELDS) {
        if (ov.fields[f] != null) {
          list.push({ row: i + 1, field: f, from: (logical[i] && logical[i][f]) || "", to: ov.fields[f], action: "override" });
        }
      }
    }
    if (ov.excluded) list.push({ row: i + 1, field: "(row)", from: "included", to: "excluded", action: "exclude" });
  }
  return list.sort((a, b) => a.row - b.row || a.field.localeCompare(b.field));
}

/**
 * The intake form works in a FLAT space keyed by dotted field names
 * ("deposit.amount"); the backend wants a NESTED facts object. These convert at
 * the boundary: `unflatten` on submit, `flatten` when prefilling from an upload.
 */

/** { "deposit.amount": 980 } → { deposit: { amount: 980 } }. Skips empty values. */
export function unflatten(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v === undefined || v === "" || v === null) continue;
    const parts = k.split(".");
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!;
      const childIsArray = /^\d+$/.test(parts[i + 1]!);
      if (node[p] === undefined || node[p] === null || typeof node[p] !== "object") {
        node[p] = childIsArray ? [] : {};
      }
      node = node[p];
    }
    node[parts[parts.length - 1]!] = v;
  }
  return out;
}

/** { deposit: { amount: 980 } } → { "deposit.amount": 980 }. Arrays kept whole. */
export function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

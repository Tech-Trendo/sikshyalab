import { useMemo } from "react";

function normalizeForCompare(value: unknown): unknown {
  if (value instanceof File) {
    return { __file: true, name: value.name, size: value.size, lastModified: value.lastModified };
  }
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] = normalizeForCompare(v);
    }
    return out;
  }
  if (typeof value === "string") return value.trimEnd();
  return value ?? null;
}

export function isFormDirty(current: unknown, baseline: unknown | null | undefined): boolean {
  if (baseline == null) return false;
  return JSON.stringify(normalizeForCompare(current)) !== JSON.stringify(normalizeForCompare(baseline));
}

/** True when live form state differs from the snapshot taken when edit mode loaded. */
export function useDirtyForm(
  current: unknown,
  baseline: unknown | null | undefined,
  enabled = true,
): boolean {
  return useMemo(
    () => (enabled ? isFormDirty(current, baseline) : false),
    [current, baseline, enabled],
  );
}

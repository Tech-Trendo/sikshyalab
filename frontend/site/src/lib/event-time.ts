/** True when the event start/end is already in the past. */
export function isEventOver(
  startDatetime?: string | null,
  endDatetime?: string | null,
): boolean {
  const endRaw = String(endDatetime || "").trim() || String(startDatetime || "").trim();
  if (!endRaw) return false;
  const endMs = new Date(endRaw).getTime();
  if (Number.isNaN(endMs)) return false;
  return Date.now() > endMs;
}

export function newestByDate<T>(
  rows: T[],
  getIso: (row: T) => string | null | undefined,
): T[] {
  return [...rows].sort((a, b) => {
    const ta = getIso(a) ? new Date(String(getIso(a))).getTime() : 0;
    const tb = getIso(b) ? new Date(String(getIso(b))).getTime() : 0;
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
    return nb - na;
  });
}

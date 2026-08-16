/** YouTube-style markers on a video resource: { time_seconds, label }. */

export type VideoTimestamp = {
  id?: string;
  time_seconds: number;
  label: string;
};

export function formatTimestampClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function normalizeVideoTimestamp(raw: unknown, index = 0): VideoTimestamp | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const time = Number(
    row.time_seconds ?? row.timeSeconds ?? row.seconds ?? row.time ?? row.start_time ?? 0,
  );
  if (!Number.isFinite(time) || time < 0) return null;
  const label = String(row.label ?? row.title ?? row.name ?? `Timestamp ${index + 1}`).trim();
  return {
    id: row.id != null ? String(row.id) : undefined,
    time_seconds: time,
    label: label || `Timestamp ${index + 1}`,
  };
}

export function normalizeVideoTimestampList(raw: unknown): VideoTimestamp[] {
  let rows: unknown[] = [];
  if (Array.isArray(raw)) {
    rows = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.results)) rows = obj.results;
    else if (Array.isArray(obj.timestamps)) rows = obj.timestamps;
    else if (Array.isArray(obj.data)) rows = obj.data;
  }
  return rows
    .map((row, i) => normalizeVideoTimestamp(row, i))
    .filter((row): row is VideoTimestamp => row != null)
    .sort((a, b) => a.time_seconds - b.time_seconds);
}

export function activeTimestampIndex(timestamps: VideoTimestamp[], currentTime: number): number {
  if (!timestamps.length) return -1;
  let active = -1;
  for (let i = 0; i < timestamps.length; i += 1) {
    if (currentTime >= timestamps[i].time_seconds) active = i;
    else break;
  }
  return active;
}

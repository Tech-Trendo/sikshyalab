/** Shared rating helpers — compute from live reviews, never invent scores. */

export type RatedItem = {
  rating?: number | null;
  course_name?: string;
  status?: string;
};

/** Mean of valid ratings (1–5). Returns null when there is no data. */
export function averageRating(items: RatedItem[], opts?: { approvedOnly?: boolean }): number | null {
  const scores = items
    .filter((r) => {
      if (opts?.approvedOnly && r.status && r.status !== "APPROVED") return false;
      return r.rating != null && Number.isFinite(r.rating) && r.rating > 0;
    })
    .map((r) => Number(r.rating));
  if (!scores.length) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/** Format for StatCard / labels. */
export function formatRating(value: number | null | undefined, fallback = "—"): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value.toFixed(1);
}

/** Average rating for one course title from review rows. */
export function averageRatingForCourse(
  items: RatedItem[],
  courseName: string,
  opts?: { approvedOnly?: boolean },
): number | null {
  const name = courseName.trim().toLowerCase();
  return averageRating(
    items.filter((r) => (r.course_name || "").trim().toLowerCase() === name),
    opts,
  );
}

export function reviewCountForCourse(
  items: RatedItem[],
  courseName: string,
  opts?: { approvedOnly?: boolean },
): number {
  const name = courseName.trim().toLowerCase();
  return items.filter((r) => {
    if ((r.course_name || "").trim().toLowerCase() !== name) return false;
    if (opts?.approvedOnly && r.status && r.status !== "APPROVED") return false;
    return r.rating != null && Number(r.rating) > 0;
  }).length;
}

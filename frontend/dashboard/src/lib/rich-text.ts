/** True when TipTap HTML has no visible text (e.g. `<p></p>`). */
export function isEmptyRichText(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return !text;
}

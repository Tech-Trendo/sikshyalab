import {
  DEFAULT_HERO_TITLE,
  type HeroTitlePart,
} from "@/components/hero/types";

export type ParseHeroTitleOptions = {
  /** Phrase to accent (navy blue). Defaults to "Programming Skill". */
  accentPhrase?: string;
  /** Used when title is empty. */
  fallback?: HeroTitlePart[];
};

/**
 * Convert a CMS / plain title string into structured `HeroTitlePart[]`.
 * Supports `\n` line breaks, or auto-splits around `accentPhrase`.
 */
export function parseHeroTitle(
  title: string | null | undefined,
  {
    accentPhrase = "Programming Skill",
    fallback = DEFAULT_HERO_TITLE,
  }: ParseHeroTitleOptions = {},
): HeroTitlePart[] {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return fallback;

  if (trimmed.includes("\n")) {
    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((text, i) => ({
      text,
      accent: Boolean(accentPhrase && text.includes(accentPhrase)),
      breakAfter: i < lines.length - 1,
    }));
  }

  if (accentPhrase) {
    const idx = trimmed.indexOf(accentPhrase);
    if (idx >= 0) {
      const before = trimmed.slice(0, idx).trim();
      const after = trimmed.slice(idx + accentPhrase.length).trim();
      const parts: HeroTitlePart[] = [];
      if (before) parts.push({ text: before, breakAfter: true });
      parts.push({
        text: accentPhrase,
        accent: true,
        breakAfter: Boolean(after),
      });
      if (after) parts.push({ text: after });
      return parts;
    }
  }

  return [{ text: trimmed }];
}

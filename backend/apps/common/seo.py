"""Shared helpers for optional per-object SEO fields."""

SEO_META_TITLE_MAX = 70
SEO_META_DESCRIPTION_MAX = 320
OG_TITLE_MAX = 70
OG_DESCRIPTION_MAX = 160

SEO_FIELD_KWARGS = {
    "meta_title": {"required": False, "allow_blank": True},
    "meta_description": {"required": False, "allow_blank": True},
    "og_title": {"required": False, "allow_blank": True},
    "og_description": {"required": False, "allow_blank": True},
    "og_image": {"required": False, "allow_null": True},
}


def truncate_seo_text(text, limit=SEO_META_DESCRIPTION_MAX):
    from apps.common.html import html_to_plain_text

    normalized = " ".join(html_to_plain_text(text or "").split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def apply_seo_fallbacks(data, *, title, description, fallback_image_url):
    """Fill empty SEO/OG keys in a serialized payload. Does not persist values."""
    title = title or ""
    if not str(data.get("meta_title") or "").strip():
        data["meta_title"] = title[:SEO_META_TITLE_MAX]
    if not str(data.get("meta_description") or "").strip():
        data["meta_description"] = truncate_seo_text(description)

    if not str(data.get("og_title") or "").strip():
        data["og_title"] = str(data.get("meta_title") or title)[:OG_TITLE_MAX]
    if not str(data.get("og_description") or "").strip():
        data["og_description"] = truncate_seo_text(
            data.get("meta_description") or description,
            OG_DESCRIPTION_MAX,
        )
    if not data.get("og_image"):
        data["og_image"] = fallback_image_url or None
    return data

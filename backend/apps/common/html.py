"""Sanitize HTML for rich-text CMS fields (course description, blog sections)."""

from __future__ import annotations

import bleach

RICH_TEXT_TAGS = [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "img",
    "span",
    "div",
    "hr",
    "code",
    "pre",
    "sub",
    "sup",
]

RICH_TEXT_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
}

RICH_TEXT_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_rich_text(value: str | None) -> str:
    """Keep safe rich-text tags; strip scripts, event handlers, and unknown markup."""
    raw = value or ""
    if not raw.strip():
        return raw.strip()
    return bleach.clean(
        raw,
        tags=RICH_TEXT_TAGS,
        attributes=RICH_TEXT_ATTRIBUTES,
        protocols=RICH_TEXT_PROTOCOLS,
        strip=True,
    )


def html_to_plain_text(value: str | None) -> str:
    """Strip all tags for SEO/plain-text fallbacks."""
    raw = value or ""
    if not raw:
        return ""
    return bleach.clean(raw, tags=[], attributes={}, strip=True)

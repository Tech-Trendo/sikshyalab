"""Helpers for hierarchical sitemap pages, canonical URLs, and XML output."""

from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal
from urllib.parse import urlparse
from xml.sax.saxutils import escape

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

SITEMAP_CACHE_VERSION_KEY = "seo:sitemap:version"
SITEMAP_XML_CACHE_PREFIX = "seo:sitemap:xml:v"
SITEMAP_TREE_CACHE_PREFIX = "seo:sitemap:tree:v"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
MAX_PARENT_DEPTH = 50


def frontend_base_url() -> str:
    return (getattr(settings, "FRONTEND_URL", "") or "http://localhost:8081").rstrip("/")


def sitemap_max_urls() -> int:
    return max(1, int(getattr(settings, "SITEMAP_MAX_URLS", 50000) or 50000))


def normalize_url_path(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return "/"
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        value = parsed.path or "/"
        if parsed.query or parsed.fragment:
            raise ValueError("URL path must not include query strings or fragments.")
    if not value.startswith("/"):
        value = f"/{value}"
    if value != "/":
        value = value.rstrip("/")
    if re.search(r"[?#]", value):
        raise ValueError("URL path must not include query strings or fragments.")
    if "//" in value:
        raise ValueError("URL path is not valid.")
    return value


def slug_from_path(path: str) -> str:
    normalized = normalize_url_path(path)
    if normalized == "/":
        return "home"
    return normalized.strip("/").replace("/", "-")


def infer_page_type(path: str) -> str:
    normalized = normalize_url_path(path)
    if normalized.startswith("/courses/") and normalized.count("/") >= 2:
        return "course"
    if normalized.startswith("/blog/") and normalized.count("/") >= 2:
        return "blog"
    if normalized.startswith("/events/") and normalized.count("/") >= 2:
        return "event"
    return "page"


def canonical_url(path: str) -> str:
    normalized = normalize_url_path(path)
    if normalized == "/":
        return f"{frontend_base_url()}/"
    return f"{frontend_base_url()}{normalized}"


def would_create_cycle(entry, parent) -> bool:
    if parent is None:
        return False
    parent_id = getattr(parent, "pk", parent)
    if entry.pk and parent_id == entry.pk:
        return True
    seen = set()
    current = parent
    depth = 0
    while current is not None and depth < MAX_PARENT_DEPTH:
        pk = getattr(current, "pk", None)
        if pk is None:
            break
        if entry.pk and pk == entry.pk:
            return True
        if pk in seen:
            return True
        seen.add(pk)
        current = getattr(current, "parent", None)
        depth += 1
    return False


def bump_sitemap_cache():
    try:
        cache.set(
            SITEMAP_CACHE_VERSION_KEY,
            int(cache.get(SITEMAP_CACHE_VERSION_KEY) or 0) + 1,
            None,
        )
    except Exception:
        pass


def sitemap_cache_version() -> int:
    return int(cache.get(SITEMAP_CACHE_VERSION_KEY) or 0)


def public_sitemap_queryset():
    from apps.seo.models import SitemapEntry

    return (
        SitemapEntry.objects.filter(is_published=True, is_indexable=True)
        .select_related("parent")
        .order_by("order", "-priority", "url_path")
    )


def serialize_public_node(entry, *, include_children=True, children_map=None) -> dict:
    lastmod = entry.lastmod or entry.updated_at
    node = {
        "id": str(entry.pk),
        "title": entry.title or entry.slug,
        "slug": entry.slug,
        "url": canonical_url(entry.url_path),
        "path": entry.url_path,
        "page_type": entry.page_type,
        "priority": float(entry.priority) if isinstance(entry.priority, Decimal) else float(entry.priority or 0),
        "change_frequency": entry.changefreq,
        "updated_at": (lastmod.isoformat() if lastmod else None),
    }
    if include_children:
        kids = []
        if children_map is not None:
            for child in children_map.get(entry.pk, []):
                kids.append(
                    serialize_public_node(
                        child, include_children=True, children_map=children_map
                    )
                )
        node["children"] = kids
    return node


def build_sitemap_tree(entries) -> list[dict]:
    pages = list(entries)
    by_id = {p.pk: p for p in pages}
    children_map: dict = {p.pk: [] for p in pages}
    roots = []
    for page in pages:
        parent_id = page.parent_id
        if parent_id and parent_id in by_id:
            children_map[parent_id].append(page)
        else:
            roots.append(page)
    return [
        serialize_public_node(root, include_children=True, children_map=children_map)
        for root in roots
    ]


def get_cached_sitemap_tree() -> list[dict]:
    version = sitemap_cache_version()
    key = f"{SITEMAP_TREE_CACHE_PREFIX}{version}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    tree = build_sitemap_tree(public_sitemap_queryset())
    cache.set(key, tree, 300)
    return tree


def _format_lastmod(value) -> str:
    if value is None:
        value = timezone.now()
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    if isinstance(value, datetime):
        return value.date().isoformat()
    return str(value)[:10]


def render_urlset_xml(entries) -> str:
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<urlset xmlns="{SITEMAP_NS}">',
    ]
    for entry in entries:
        loc = escape(canonical_url(entry.url_path))
        lastmod = _format_lastmod(entry.lastmod or entry.updated_at)
        changefreq = escape(entry.changefreq or "weekly")
        priority = f"{float(entry.priority):.1f}"
        parts.append("  <url>")
        parts.append(f"    <loc>{loc}</loc>")
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
        parts.append(f"    <changefreq>{changefreq}</changefreq>")
        parts.append(f"    <priority>{priority}</priority>")
        parts.append("  </url>")
    parts.append("</urlset>")
    return "\n".join(parts) + "\n"


def render_sitemap_index_xml(page_urls: list[tuple[str, str]]) -> str:
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<sitemapindex xmlns="{SITEMAP_NS}">',
    ]
    for loc, lastmod in page_urls:
        parts.append("  <sitemap>")
        parts.append(f"    <loc>{escape(loc)}</loc>")
        if lastmod:
            parts.append(f"    <lastmod>{escape(lastmod)}</lastmod>")
        parts.append("  </sitemap>")
    parts.append("</sitemapindex>")
    return "\n".join(parts) + "\n"

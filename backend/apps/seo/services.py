"""SEO scoring and helper utilities."""

from __future__ import annotations

from django.utils import timezone

from apps.seo.models import SEOMetadata, SitemapEntry


DEFAULT_SITEMAP_PATHS = (
    ("/", 1.0, "weekly"),
    ("/courses", 0.9, "weekly"),
    ("/about", 0.7, "monthly"),
    ("/blog", 0.8, "weekly"),
    ("/events", 0.8, "weekly"),
    ("/contact", 0.6, "monthly"),
    ("/faq", 0.6, "monthly"),
    ("/gallery", 0.5, "monthly"),
    ("/career", 0.6, "monthly"),
    ("/verify", 0.7, "monthly"),
)


def calculate_seo_score(metadata: SEOMetadata) -> int:
    """
    Score SEO metadata 0–100 based on title length, description length,
    keywords, and Open Graph presence.
    """
    score = 0

    title = (metadata.meta_title or "").strip()
    if title:
        length = len(title)
        if 30 <= length <= 60:
            score += 25
        elif 15 <= length < 30 or 60 < length <= 70:
            score += 15
        else:
            score += 8

    description = (metadata.meta_description or "").strip()
    if description:
        length = len(description)
        if 120 <= length <= 160:
            score += 25
        elif 70 <= length < 120 or 160 < length <= 320:
            score += 15
        else:
            score += 8

    keywords = (metadata.meta_keywords or "").strip()
    if keywords:
        score += 10
        parts = [k.strip() for k in keywords.split(",") if k.strip()]
        if 3 <= len(parts) <= 10:
            score += 5

    focus = (metadata.focus_keyword or "").strip().lower()
    if focus:
        score += 5
        if focus in title.lower():
            score += 5
        if focus in description.lower():
            score += 5

    if (metadata.og_title or "").strip():
        score += 5
    if (metadata.og_description or "").strip():
        score += 5
    if metadata.og_image:
        score += 5

    if (metadata.canonical_url or "").strip():
        score += 5

    if metadata.structured_data:
        score += 5

    if metadata.is_indexed and "noindex" not in (metadata.robots or "").lower():
        score += 5

    return max(0, min(100, score))


def refresh_seo_score(metadata: SEOMetadata, save: bool = True) -> SEOMetadata:
    """Recalculate and optionally persist ``seo_score``."""
    metadata.seo_score = calculate_seo_score(metadata)
    if save:
        metadata.save(update_fields=["seo_score", "updated_at"])
    return metadata


def ensure_default_sitemap_entries() -> int:
    """Upsert core public routes + published courses/blog/events into the sitemap."""
    created = 0
    now = timezone.now()
    for path, priority, changefreq in DEFAULT_SITEMAP_PATHS:
        _, was_created = SitemapEntry.objects.get_or_create(
            url_path=path,
            defaults={
                "title": "Home" if path == "/" else path.strip("/").replace("-", " ").title(),
                "slug": "home" if path == "/" else path.strip("/").replace("/", "-"),
                "page_type": SitemapEntry.PageType.PAGE,
                "priority": priority,
                "changefreq": changefreq,
                "lastmod": now,
                "is_active": True,
                "is_published": True,
                "is_indexable": True,
            },
        )
        if was_created:
            created += 1

    try:
        from apps.courses.models import Course

        for course in Course.objects.filter(is_published=True).only("slug", "updated_at"):
            path = f"/courses/{course.slug}"
            _, was_created = SitemapEntry.objects.get_or_create(
                url_path=path,
                defaults={
                    "title": course.slug.replace("-", " ").title(),
                    "slug": f"courses-{course.slug}",
                    "page_type": SitemapEntry.PageType.COURSE,
                    "priority": 0.85,
                    "changefreq": "weekly",
                    "lastmod": course.updated_at or now,
                    "is_active": True,
                    "is_published": True,
                    "is_indexable": True,
                },
            )
            if was_created:
                created += 1
    except Exception:
        pass

    try:
        from apps.cms.models import BlogPost, Event

        for post in BlogPost.objects.filter(is_published=True).only("slug", "updated_at"):
            path = f"/blog/{post.slug}"
            _, was_created = SitemapEntry.objects.get_or_create(
                url_path=path,
                defaults={
                    "title": post.slug.replace("-", " ").title(),
                    "slug": f"blog-{post.slug}",
                    "page_type": SitemapEntry.PageType.BLOG,
                    "priority": 0.7,
                    "changefreq": "monthly",
                    "lastmod": post.updated_at or now,
                    "is_active": True,
                    "is_published": True,
                    "is_indexable": True,
                },
            )
            if was_created:
                created += 1

        for event in Event.objects.filter(is_published=True).only("slug", "updated_at"):
            path = f"/events/{event.slug}"
            _, was_created = SitemapEntry.objects.get_or_create(
                url_path=path,
                defaults={
                    "title": event.slug.replace("-", " ").title(),
                    "slug": f"events-{event.slug}",
                    "page_type": SitemapEntry.PageType.EVENT,
                    "priority": 0.7,
                    "changefreq": "weekly",
                    "lastmod": event.updated_at or now,
                    "is_active": True,
                    "is_published": True,
                    "is_indexable": True,
                },
            )
            if was_created:
                created += 1
    except Exception:
        pass

    return created

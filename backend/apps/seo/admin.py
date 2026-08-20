from django.contrib import admin

from apps.seo.models import RedirectRule, SEOMetadata, SitemapEntry


@admin.register(SEOMetadata)
class SEOMetadataAdmin(admin.ModelAdmin):
    list_display = (
        "meta_title",
        "content_type",
        "object_id",
        "slug",
        "seo_score",
        "is_indexed",
        "updated_at",
    )
    list_filter = ("is_indexed", "content_type", "seo_score")
    search_fields = (
        "meta_title",
        "meta_description",
        "og_title",
        "og_description",
        "meta_keywords",
        "slug",
        "focus_keyword",
        "canonical_url",
    )
    raw_id_fields = ("content_type",)
    readonly_fields = ("seo_score",)
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "content_type",
                    "object_id",
                    "slug",
                    "canonical_url",
                    "is_indexed",
                    "robots",
                    "focus_keyword",
                    "seo_score",
                )
            },
        ),
        (
            "Meta tags",
            {"fields": ("meta_title", "meta_description", "meta_keywords")},
        ),
        (
            "Open Graph",
            {
                "fields": ("og_title", "og_description", "og_image", "og_type"),
                "description": (
                    "OG title recommended 60 characters. OG description recommended 160. "
                    "OG image recommended 1200×630px. Blank OG fields fall back to meta title/description."
                ),
            },
        ),
        (
            "Twitter",
            {"fields": ("twitter_card", "twitter_title", "twitter_description", "twitter_image")},
        ),
        ("Advanced", {"fields": ("structured_data",)}),
    )


@admin.register(SitemapEntry)
class SitemapEntryAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "url_path",
        "page_type",
        "parent",
        "is_published",
        "is_indexable",
        "priority",
        "changefreq",
        "order",
        "updated_at",
    )
    list_editable = (
        "is_published",
        "is_indexable",
        "priority",
        "changefreq",
        "order",
    )
    list_filter = ("page_type", "is_published", "is_indexable", "changefreq")
    search_fields = ("title", "slug", "url_path")
    ordering = ("order", "-priority", "url_path")
    list_select_related = ("parent",)
    raw_id_fields = ("parent",)
    readonly_fields = ("is_active", "created_at", "updated_at")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "slug",
                    "url_path",
                    "page_type",
                    "parent",
                    "order",
                )
            },
        ),
        (
            "Indexing",
            {
                "fields": (
                    "is_published",
                    "is_indexable",
                    "priority",
                    "changefreq",
                    "lastmod",
                    "is_active",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(RedirectRule)
class RedirectRuleAdmin(admin.ModelAdmin):
    list_display = ("from_path", "to_path", "status_code", "is_active")
    list_filter = ("status_code", "is_active")
    search_fields = ("from_path", "to_path")

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
        "meta_keywords",
        "slug",
        "focus_keyword",
        "canonical_url",
    )
    raw_id_fields = ("content_type",)
    readonly_fields = ("seo_score",)


@admin.register(SitemapEntry)
class SitemapEntryAdmin(admin.ModelAdmin):
    list_display = ("url_path", "changefreq", "priority", "lastmod", "is_active")
    list_filter = ("changefreq", "is_active")
    search_fields = ("url_path",)
    ordering = ("-priority", "url_path")


@admin.register(RedirectRule)
class RedirectRuleAdmin(admin.ModelAdmin):
    list_display = ("from_path", "to_path", "status_code", "is_active")
    list_filter = ("status_code", "is_active")
    search_fields = ("from_path", "to_path")

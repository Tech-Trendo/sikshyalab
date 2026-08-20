"""django-filter FilterSets for the SEO sitemap."""

import django_filters

from apps.seo.models import SitemapEntry


class SitemapEntryFilter(django_filters.FilterSet):
    page_type = django_filters.CharFilter(field_name="page_type", lookup_expr="exact")
    is_published = django_filters.BooleanFilter(field_name="is_published")
    is_indexable = django_filters.BooleanFilter(field_name="is_indexable")
    is_active = django_filters.BooleanFilter(field_name="is_active")
    parent = django_filters.UUIDFilter(field_name="parent")
    parent_isnull = django_filters.BooleanFilter(field_name="parent", lookup_expr="isnull")

    class Meta:
        model = SitemapEntry
        fields = [
            "page_type",
            "is_published",
            "is_indexable",
            "is_active",
            "parent",
            "changefreq",
        ]

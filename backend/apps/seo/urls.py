from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.seo.views import (
    ContentTypeListAPIView,
    RedirectRuleViewSet,
    SEOLookupAPIView,
    SEOMetadataViewSet,
    SitemapEntryViewSet,
)

app_name = "seo"

router = DefaultRouter()
router.register(r"metadata", SEOMetadataViewSet, basename="seo-metadata")
router.register(r"sitemap", SitemapEntryViewSet, basename="sitemap-entry")
router.register(r"redirects", RedirectRuleViewSet, basename="redirect-rule")

urlpatterns = [
    path("lookup/", SEOLookupAPIView.as_view(), name="seo-lookup"),
    path("content-types/", ContentTypeListAPIView.as_view(), name="seo-content-types"),
    path("", include(router.urls)),
]

"""
ShikshaLab URL configuration.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.common.media_access import AuthenticatedMediaView, debug_media_serve
from apps.seo.sitemap_views import SitemapXMLChunkView, SitemapXMLView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("sitemap.xml", SitemapXMLView.as_view(), name="sitemap-xml"),
    path("sitemaps/<int:page>.xml", SitemapXMLChunkView.as_view(), name="sitemap-xml-chunk"),
    # OpenAPI schema & docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    # API v1 (canonical) — only mount once to keep URL namespaces unique
    path("api/v1/", include("config.api_urls")),
]

if settings.DEBUG:
    # Serve uploaded CMS/media files from MEDIA_ROOT during development.
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
        view=debug_media_serve,
    )
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

    if "debug_toolbar" in settings.INSTALLED_APPS:
        urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]

# Production (and DEBUG fallback when the file is not on disk yet): gated S3/disk view.
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", AuthenticatedMediaView.as_view(), name="media"),
]

admin.site.site_header = "ShikshaLab Administration"
admin.site.site_title = "ShikshaLab Admin"
admin.site.index_title = "Welcome to ShikshaLab"

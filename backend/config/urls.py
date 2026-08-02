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

from apps.common.media_access import AuthenticatedMediaView

urlpatterns = [
    path("admin/", admin.site.urls),
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
    # Media — always gated (public CMS assets open; lesson files require auth)
    re_path(r"^media/(?P<path>.*)$", AuthenticatedMediaView.as_view(), name="media"),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

    if "debug_toolbar" in settings.INSTALLED_APPS:
        urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]

admin.site.site_header = "ShikshaLab Administration"
admin.site.site_title = "ShikshaLab Admin"
admin.site.index_title = "Welcome to ShikshaLab"

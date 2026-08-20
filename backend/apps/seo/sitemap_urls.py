from django.urls import path

from apps.seo.sitemap_views import SitemapPageDetailAPIView, SitemapPageListAPIView, SitemapTreeAPIView

app_name = "sitemap"

urlpatterns = [
    path("", SitemapTreeAPIView.as_view(), name="sitemap-tree"),
    path("pages/", SitemapPageListAPIView.as_view(), name="sitemap-pages"),
    path("<path:slug>/", SitemapPageDetailAPIView.as_view(), name="sitemap-detail"),
]

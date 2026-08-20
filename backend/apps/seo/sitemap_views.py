"""Public hierarchical sitemap JSON + XML endpoints for the Next.js frontend."""

from __future__ import annotations

from math import ceil

from django.core.cache import cache
from django.http import HttpResponse
from django.utils import timezone
from django.views import View
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.common.pagination import StandardPagination
from apps.common.responses import error_response, success_response
from apps.seo.filters import SitemapEntryFilter
from apps.seo.serializers import SitemapPageFlatSerializer
from apps.seo.sitemap_utils import (
    SITEMAP_XML_CACHE_PREFIX,
    get_cached_sitemap_tree,
    public_sitemap_queryset,
    render_sitemap_index_xml,
    render_urlset_xml,
    serialize_public_node,
    sitemap_cache_version,
    sitemap_max_urls,
)


def _xml_response(body: str) -> HttpResponse:
    response = HttpResponse(body, content_type="application/xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=300"
    return response


class SitemapTreeAPIView(APIView):
    """GET /api/v1/sitemap/ — complete public hierarchical tree."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        tree = get_cached_sitemap_tree()
        return success_response(data=tree, message="Sitemap tree retrieved.")


class SitemapPageListAPIView(ListAPIView):
    """GET /api/v1/sitemap/pages/ — paginated flat list with search/filter."""

    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = SitemapPageFlatSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = SitemapEntryFilter
    search_fields = ["title", "slug", "url_path"]
    ordering_fields = ["order", "priority", "updated_at", "title", "url_path"]
    ordering = ["order", "-priority", "url_path"]

    def get_queryset(self):
        return public_sitemap_queryset()


class SitemapPageDetailAPIView(APIView):
    """GET /api/v1/sitemap/<slug>/ — one public page plus nested public children."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug: str):
        key = (slug or "").strip().strip("/") or "home"
        qs = public_sitemap_queryset()
        page = qs.filter(slug=key).first()
        if page is None:
            path = "/" if key in ("home", "") else f"/{key}"
            page = qs.filter(url_path=path).first()
        if page is None:
            return error_response(
                message="Sitemap page not found.",
                status_code=404,
            )

        public_pages = list(qs)
        by_id = {p.pk: p for p in public_pages}
        children_map: dict = {p.pk: [] for p in public_pages}
        for node in public_pages:
            if node.parent_id and node.parent_id in by_id:
                children_map[node.parent_id].append(node)

        data = serialize_public_node(page, include_children=True, children_map=children_map)
        return success_response(data=data, message="Sitemap page retrieved.")


class SitemapXMLView(View):
    """
    GET /sitemap.xml — Google sitemap protocol.

    Returns a urlset when the URL count is within SITEMAP_MAX_URLS, otherwise a
    sitemap index pointing at /sitemaps/<n>.xml.
    """

    http_method_names = ["get", "head"]

    def get(self, request, *args, **kwargs):
        page_num = request.GET.get("page")
        if page_num:
            try:
                parsed = int(page_num)
            except (TypeError, ValueError):
                return HttpResponse("Invalid page.", status=400, content_type="text/plain")
            return _xml_response(_urlset_for_page(parsed))

        entries = list(public_sitemap_queryset())
        max_urls = sitemap_max_urls()
        if len(entries) <= max_urls:
            return _xml_response(_cached_urlset(entries, page=1))

        total_pages = ceil(len(entries) / max_urls) or 1
        latest = max(
            (e.lastmod or e.updated_at or timezone.now() for e in entries),
            default=timezone.now(),
        )
        lastmod = latest.date().isoformat() if hasattr(latest, "date") else str(latest)[:10]
        index_urls = []
        for n in range(1, total_pages + 1):
            loc = request.build_absolute_uri(f"/sitemaps/{n}.xml")
            index_urls.append((loc, lastmod))
        return _xml_response(render_sitemap_index_xml(index_urls))


class SitemapXMLChunkView(View):
    """GET /sitemaps/<page>.xml — one split sitemap file."""

    http_method_names = ["get", "head"]

    def get(self, request, page: int, *args, **kwargs):
        if page < 1:
            return HttpResponse("Invalid page.", status=400, content_type="text/plain")
        xml = _urlset_for_page(page)
        if xml is None:
            return HttpResponse("Sitemap page not found.", status=404, content_type="text/plain")
        return _xml_response(xml)


def _cached_urlset(entries, *, page: int) -> str:
    version = sitemap_cache_version()
    key = f"{SITEMAP_XML_CACHE_PREFIX}{version}:p{page}:n{len(entries)}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    xml = render_urlset_xml(entries)
    cache.set(key, xml, 300)
    return xml


def _urlset_for_page(page: int) -> str | None:
    entries = list(public_sitemap_queryset())
    max_urls = sitemap_max_urls()
    start = (page - 1) * max_urls
    if start >= len(entries) and page != 1:
        return None
    chunk = entries[start : start + max_urls]
    return _cached_urlset(chunk, page=page)

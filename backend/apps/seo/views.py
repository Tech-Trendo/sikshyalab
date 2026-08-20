"""DRF viewsets for SEO management and public lookup."""

from urllib.parse import urlparse

from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import error_response, success_response
from apps.seo.models import RedirectRule, SEOMetadata, SitemapEntry
from apps.seo.permissions import IsAdminOrStaff, IsAdminOrStaffWrite
from apps.seo.filters import SitemapEntryFilter
from apps.seo.serializers import (
    ContentTypeLookupSerializer,
    RedirectRuleSerializer,
    SEOMetadataPublicSerializer,
    SEOMetadataSerializer,
    SitemapEntrySerializer,
)
from apps.seo.services import calculate_seo_score, ensure_default_sitemap_entries, refresh_seo_score

_SEO_LOOKUP_CACHE_TTL = 60
_SITEMAP_ENSURE_CACHE_KEY = "seo:sitemap:ensure_defaults:v1"
_SITEMAP_ENSURE_TTL = 300
_SEO_LOOKUP_VERSION_KEY = "seo:lookup:version"


def _bump_seo_lookup_cache():
    try:
        cache.set(
            _SEO_LOOKUP_VERSION_KEY,
            int(cache.get(_SEO_LOOKUP_VERSION_KEY) or 0) + 1,
            None,
        )
    except Exception:
        pass


def _normalize_seo_path(raw: str) -> str:
    """Normalize a path or absolute URL to a comparable pathname (``/`` or ``/about``)."""
    value = (raw or "").strip()
    if not value:
        return "/"
    if value.startswith("http://") or value.startswith("https://"):
        try:
            value = urlparse(value).path or "/"
        except Exception:
            return "/"
    if not value.startswith("/"):
        value = f"/{value}"
    return value.rstrip("/") or "/"


def _lookup_metadata_by_path(qs, path: str):
    """Exact path match on canonical_url (relative or absolute), then safe slug fallback."""
    path_norm = _normalize_seo_path(path)
    path_candidates = {path_norm}
    if path_norm != "/":
        path_candidates.add(f"{path_norm}/")
    else:
        path_candidates.add("/")

    metadata = qs.filter(canonical_url__in=list(path_candidates)).first()
    if metadata is not None:
        return metadata

    # Absolute canonical URLs (URLField) — compare by pathname only.
    # Limit scan to absolute URLs so relative rows are not loaded repeatedly.
    for row in (
        qs.select_related(None)
        .filter(Q(canonical_url__startswith="http://") | Q(canonical_url__startswith="https://"))
        .only("pk", "canonical_url")[:300]
    ):
        if _normalize_seo_path(row.canonical_url) == path_norm:
            return qs.filter(pk=row.pk).first()

    if path_norm == "/":
        # Homepage: prefer explicit home/index slugs without hijacking unrelated rows.
        return (
            qs.filter(slug__in=["home", "index", "homepage", ""])
            .filter(
                Q(canonical_url="")
                | Q(canonical_url__isnull=True)
                | Q(canonical_url__in=["/", ""])
            )
            .first()
        )

    slug = path_norm.rsplit("/", 1)[-1]
    by_slug = qs.filter(slug=slug)
    metadata = by_slug.filter(
        Q(canonical_url__in=list(path_candidates))
        | Q(canonical_url="")
        | Q(canonical_url__isnull=True)
    ).first()
    if metadata is None and path_norm == f"/{slug}":
        metadata = by_slug.first()
    return metadata


def _cached_lookup_pk(*, cache_key: str, resolver):
    cached = cache.get(cache_key)
    if cached is not None:
        if cached == 0:
            return None
        return SEOMetadata.objects.select_related("content_type").filter(pk=cached).first()

    metadata = resolver()
    cache.set(cache_key, metadata.pk if metadata is not None else 0, _SEO_LOOKUP_CACHE_TTL)
    return metadata


class SEOMetadataViewSet(viewsets.ModelViewSet):
    queryset = SEOMetadata.objects.select_related("content_type")
    serializer_class = SEOMetadataSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["content_type", "object_id", "slug", "is_indexed"]
    search_fields = [
        "meta_title",
        "meta_description",
        "meta_keywords",
        "slug",
        "focus_keyword",
        "canonical_url",
    ]
    ordering_fields = ["seo_score", "updated_at", "created_at", "meta_title"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(is_indexed=True)

    def get_serializer_class(self):
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return SEOMetadataSerializer
        return SEOMetadataPublicSerializer

    def perform_create(self, serializer):
        serializer.save()
        _bump_seo_lookup_cache()

    def perform_update(self, serializer):
        serializer.save()
        _bump_seo_lookup_cache()

    def perform_destroy(self, instance):
        instance.delete()
        _bump_seo_lookup_cache()

    @action(detail=True, methods=["post", "get"], url_path="score")
    def score(self, request, pk=None):
        metadata = self.get_object()
        if request.method == "POST":
            refresh_seo_score(metadata, save=True)
            metadata.refresh_from_db()
            message = "SEO score recalculated."
        else:
            message = "SEO score calculated."
        return success_response(
            data={
                "seo_score": metadata.seo_score if request.method == "POST" else calculate_seo_score(metadata),
                "breakdown_score": calculate_seo_score(metadata),
                "metadata": SEOMetadataSerializer(metadata, context={"request": request}).data,
            },
            message=message,
        )


class SitemapEntryViewSet(viewsets.ModelViewSet):
    queryset = SitemapEntry.objects.select_related("parent").all()
    serializer_class = SitemapEntrySerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = SitemapEntryFilter
    search_fields = ["title", "slug", "url_path"]
    ordering_fields = [
        "order",
        "priority",
        "lastmod",
        "url_path",
        "title",
        "created_at",
        "updated_at",
    ]
    ordering = ["order", "-priority", "url_path"]

    def get_queryset(self):
        # Avoid upserting defaults on every list/retrieve; run at most once per TTL.
        if cache.add(_SITEMAP_ENSURE_CACHE_KEY, 1, _SITEMAP_ENSURE_TTL):
            ensure_default_sitemap_entries()
        qs = super().get_queryset().annotate(
            children_count_annotated=Count("children", distinct=True)
        )
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(is_published=True, is_indexable=True, is_active=True)

    @action(detail=False, methods=["get"], url_path="tree", permission_classes=[AllowAny])
    def tree(self, request):
        from apps.seo.sitemap_utils import get_cached_sitemap_tree

        if cache.add(_SITEMAP_ENSURE_CACHE_KEY, 1, _SITEMAP_ENSURE_TTL):
            ensure_default_sitemap_entries()
        return success_response(
            data=get_cached_sitemap_tree(),
            message="Sitemap tree retrieved.",
        )


class RedirectRuleViewSet(viewsets.ModelViewSet):
    queryset = RedirectRule.objects.all()
    serializer_class = RedirectRuleSerializer
    permission_classes = [IsAdminOrStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status_code", "is_active"]
    search_fields = ["from_path", "to_path"]
    ordering_fields = ["from_path", "status_code", "created_at"]
    ordering = ["from_path"]

    @action(detail=False, methods=["get"], url_path="resolve", permission_classes=[AllowAny])
    def resolve(self, request):
        path = request.query_params.get("path", "")
        if not path:
            return error_response(message="Query parameter 'path' is required.")
        rule = RedirectRule.objects.filter(from_path=path, is_active=True).first()
        if rule is None:
            return error_response(
                message="No redirect found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(
            data=RedirectRuleSerializer(rule).data,
            message="Redirect resolved.",
        )


class SEOLookupAPIView(APIView):
    """
    Public SEO lookup by content_type+id, app_label+model+object_id, slug, or path.

    GET /api/v1/seo/lookup/?content_type=<id>&object_id=<uuid>
    GET /api/v1/seo/lookup/?app_label=cms&model=page&object_id=<uuid>
    GET /api/v1/seo/lookup/?slug=about
    GET /api/v1/seo/lookup/?path=/about
    GET /api/v1/seo/lookup/?path=/

    Missing metadata returns HTTP 200 with ``data: null`` (not 404) so marketing
    pages can fall back to defaults without treating lookup as a hard error.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        serializer = ContentTypeLookupSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        qs = SEOMetadata.objects.select_related("content_type").filter(is_indexed=True)
        version = cache.get(_SEO_LOOKUP_VERSION_KEY) or 0

        if data.get("content_type") and data.get("object_id"):
            ct_id = data["content_type"].pk
            oid = data["object_id"]
            cache_key = f"seo:lookup:v1:{version}:ct:{ct_id}:{oid}"
            metadata = _cached_lookup_pk(
                cache_key=cache_key,
                resolver=lambda: qs.filter(
                    content_type=data["content_type"],
                    object_id=data["object_id"],
                ).first(),
            )
        elif data.get("slug"):
            slug = data["slug"]
            cache_key = f"seo:lookup:v1:{version}:slug:{slug}"
            metadata = _cached_lookup_pk(
                cache_key=cache_key,
                resolver=lambda: qs.filter(slug=slug).first(),
            )
        elif data.get("path") is not None:
            path_norm = _normalize_seo_path(data["path"])
            cache_key = f"seo:lookup:v1:{version}:path:{path_norm}"
            metadata = _cached_lookup_pk(
                cache_key=cache_key,
                resolver=lambda: _lookup_metadata_by_path(qs, data["path"]),
            )
        else:
            metadata = None

        if metadata is None:
            return success_response(
                data=None,
                message="No SEO metadata for this lookup.",
            )

        return success_response(
            data=SEOMetadataPublicSerializer(
                metadata, context={"request": request}
            ).data,
            message="SEO metadata retrieved.",
        )


class ContentTypeListAPIView(APIView):
    """List content types useful when attaching SEO metadata (admin)."""

    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        cts = ContentType.objects.order_by("app_label", "model")
        data = [
            {
                "id": ct.id,
                "app_label": ct.app_label,
                "model": ct.model,
                "label": f"{ct.app_label}.{ct.model}",
            }
            for ct in cts
        ]
        return success_response(data=data)

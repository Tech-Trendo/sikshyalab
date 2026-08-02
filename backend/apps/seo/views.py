"""DRF viewsets for SEO management and public lookup."""

from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
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
from apps.seo.serializers import (
    ContentTypeLookupSerializer,
    RedirectRuleSerializer,
    SEOMetadataPublicSerializer,
    SEOMetadataSerializer,
    SitemapEntrySerializer,
)
from apps.seo.services import calculate_seo_score, ensure_default_sitemap_entries, refresh_seo_score


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
    queryset = SitemapEntry.objects.all()
    serializer_class = SitemapEntrySerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["changefreq", "is_active"]
    search_fields = ["url_path"]
    ordering_fields = ["priority", "lastmod", "url_path", "created_at"]
    ordering = ["-priority", "url_path"]

    def get_queryset(self):
        ensure_default_sitemap_entries()
        qs = super().get_queryset()
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(is_active=True)


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
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        serializer = ContentTypeLookupSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        qs = SEOMetadata.objects.select_related("content_type").filter(is_indexed=True)

        if data.get("content_type") and data.get("object_id"):
            metadata = qs.filter(
                content_type=data["content_type"],
                object_id=data["object_id"],
            ).first()
        elif data.get("slug"):
            metadata = qs.filter(slug=data["slug"]).first()
        elif data.get("path"):
            # Exact path match only — never use icontains("/") which matches every URL
            # and incorrectly returns unrelated SEO (e.g. a course titled "Quality Assurance").
            path = data["path"].strip() or "/"
            if not path.startswith("/"):
                path = f"/{path}"
            path_no_slash = path.rstrip("/") or "/"
            path_candidates = {path, path_no_slash}
            if path_no_slash != "/":
                path_candidates.add(f"{path_no_slash}/")

            metadata = qs.filter(canonical_url__in=list(path_candidates)).first()
            if metadata is None and path_no_slash != "/":
                slug = path_no_slash.rsplit("/", 1)[-1]
                # Prefer slug rows whose canonical matches this path; else single-segment paths
                # may match by slug alone (e.g. /about → slug=about).
                by_slug = qs.filter(slug=slug)
                metadata = by_slug.filter(
                    Q(canonical_url__in=list(path_candidates))
                    | Q(canonical_url="")
                    | Q(canonical_url__isnull=True)
                ).first()
                if metadata is None and path_no_slash == f"/{slug}":
                    metadata = by_slug.first()
        else:
            metadata = None

        if metadata is None:
            return error_response(
                message="SEO metadata not found.",
                status_code=status.HTTP_404_NOT_FOUND,
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

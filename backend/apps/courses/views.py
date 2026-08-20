"""
API views for the courses app.
"""

import logging

from django.db.models import Count, IntegerField, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, user_has_role
from apps.content.models import Chapter, Part, Topic, VideoPart
from apps.courses.filters import (
    CourseCategoryFilter,
    CourseFilter,
    CourseInstructorFilter,
)
from apps.courses.models import Course, CourseCategory, CourseHighlight, CourseInstructor
from apps.content.models import CourseFAQ
from apps.courses.permissions import IsAdminOrReadOnlyCategory, IsAdminOrReadOnlyCourse
from apps.courses.serializers import (
    CourseCategorySerializer,
    CourseInstructorSerializer,
    CourseListSerializer,
    CourseSerializer,
)
from apps.common.responses import success_response
from apps.enrollments.models import Enrollment

_COUNTED_ENROLLMENT_STATUSES = (
    Enrollment.Status.APPROVED,
    Enrollment.Status.ACTIVE,
    Enrollment.Status.COMPLETED,
    Enrollment.Status.SUSPENDED,
)


def _annotate_students_count(qs):
    """Single subquery for students_count (safe with teacher .distinct() filters)."""
    enrollment_counts = (
        Enrollment.objects.filter(
            course_id=OuterRef("pk"),
            status__in=_COUNTED_ENROLLMENT_STATUSES,
        )
        .values("course_id")
        .annotate(c=Count("student_id", distinct=True))
        .values("c")[:1]
    )
    return qs.annotate(
        students_count_annotated=Coalesce(
            Subquery(enrollment_counts, output_field=IntegerField()),
            Value(0),
        )
    )

logger = logging.getLogger(__name__)


def _format_duration(seconds: int | None) -> str | None:
    total = int(seconds or 0)
    if total <= 0:
        return None
    minutes, secs = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def _part_url(part) -> str:
    file_field = getattr(part, "video_file", None)
    if file_field:
        try:
            return file_field.url
        except ValueError:
            pass
    return getattr(part, "video_url", "") or ""


class CourseCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CourseCategorySerializer
    permission_classes = [IsAdminOrReadOnlyCategory]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CourseCategoryFilter
    search_fields = ["name", "slug", "description"]
    ordering_fields = ["order", "name", "created_at"]
    ordering = ["order", "name"]
    lookup_field = "slug"
    lookup_value_regex = r"[-a-zA-Z0-9_]+"

    def get_queryset(self):
        return (
            CourseCategory.objects.select_related("parent")
            .prefetch_related("children")
            .annotate(
                children_count_annotated=Count("children", distinct=True),
                course_count_annotated=Count(
                    "courses",
                    filter=Q(
                        courses__is_published=True,
                        courses__status=Course.Status.PUBLISHED,
                    ),
                    distinct=True,
                ),
            )
        )


class CourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnlyCourse]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CourseFilter
    search_fields = ["title", "description", "short_description", "slug"]
    ordering_fields = [
        "created_at",
        "title",
        "price",
        "start_date",
        "is_featured",
        "status",
    ]
    ordering = ["-created_at"]
    lookup_field = "slug"
    lookup_value_regex = r"[-a-zA-Z0-9_]+"

    def get_queryset(self):
        prefetches = [
            "categories",
            "instructors__teacher__user",
        ]
        if self.action in ("retrieve", "update", "partial_update"):
            prefetches.extend(
                [
                    Prefetch(
                        "faqs",
                        queryset=CourseFAQ.objects.order_by("order", "created_at"),
                    ),
                    Prefetch(
                        "highlights",
                        queryset=CourseHighlight.objects.order_by("order", "created_at"),
                    ),
                ]
            )
        qs = _annotate_students_count(
            Course.objects.select_related(
                "created_by",
            ).prefetch_related(*prefetches)
        )
        user = self.request.user
        if user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user.is_authenticated and user_has_role(user, ROLE_TEACHER):
            # Teachers: only courses they instruct or created (matches frontend My Courses)
            return qs.filter(
                Q(instructors__teacher__user=user) | Q(created_by=user)
            ).distinct()
        # Public / students: published only
        return qs.filter(is_published=True, status=Course.Status.PUBLISHED)

    def get_serializer_class(self):
        if self.action == "list":
            return CourseListSerializer
        return CourseSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can create courses."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can delete courses."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["get"],
        url_path="curriculum",
        permission_classes=[AllowAny],
        authentication_classes=[],
    )
    def curriculum(self, request, slug=None):
        """Public outline of published chapters/parts for a course."""
        course = self.get_object()
        chapters = (
            Chapter.objects.filter(course=course, is_published=True)
            .select_related("video")
            .prefetch_related(
                Prefetch(
                    "parts",
                    queryset=Part.objects.prefetch_related(
                        Prefetch("topics", queryset=Topic.objects.order_by("order", "id")),
                    ).order_by("order", "id"),
                ),
                Prefetch(
                    "video__video_parts",
                    queryset=VideoPart.objects.order_by("order", "id"),
                ),
            )
            .order_by("order", "id")
        )
        payload = []
        for chapter in chapters:
            video = chapter.video
            video_payload = None
            if video is not None:
                video_parts = list(getattr(video, "_prefetched_objects_cache", {}).get("video_parts", video.video_parts.all()))
                video_payload = {
                    "id": video.id,
                    "title": video.title,
                    "url": _part_url(video),
                    "duration": video.video_duration_seconds,
                    "parts": [
                        {
                            "id": part.id,
                            "video": part.video_id,
                            "title": part.title,
                            "start_time": part.start_time,
                            "end_time": part.end_time,
                            "order": part.order,
                        }
                        for part in video_parts
                    ],
                }
            chapter_parts = list(getattr(chapter, "_prefetched_objects_cache", {}).get("parts", chapter.parts.all()))
            parts = [
                {
                    "id": part.id,
                    "title": part.title,
                    "type": (part.content_type or "VIDEO").lower(),
                    "duration": _format_duration(part.video_duration_seconds),
                    "is_preview": bool(part.is_preview),
                    "topics": [
                        {
                            "id": topic.id,
                            "title": topic.title,
                            "order": topic.order,
                        }
                        for topic in list(
                            getattr(part, "_prefetched_objects_cache", {}).get(
                                "topics", part.topics.order_by("order", "id")
                            )
                        )
                    ],
                }
                for part in chapter_parts
                if part.is_published and part.pk != chapter.video_id
            ]
            payload.append(
                {
                    "title": chapter.title,
                    "description": chapter.description,
                    "video": video_payload,
                    "parts": parts,
                }
            )
        return success_response(data=payload)

    @action(
        detail=True,
        methods=["get"],
        url_path="class-schedules",
        permission_classes=[AllowAny],
        authentication_classes=[],
    )
    def class_schedules(self, request, slug=None):
        """Public upcoming class sessions grouped by date (same fetch pattern as curriculum)."""
        from apps.content.schedule_utils import group_class_schedules, upcoming_class_schedules_qs

        course = self.get_object()
        qs = upcoming_class_schedules_qs(course, public_only=True)
        return success_response(data=group_class_schedules(qs))

    @action(detail=True, methods=["get", "put", "patch"], url_path="seo")
    def seo(self, request, slug=None):
        """
        Get or update SEO metadata for this course (admin/staff write).
        Public/auth GET returns indexed SEO for the course when available.
        """
        from django.contrib.contenttypes.models import ContentType

        from apps.seo.models import SEOMetadata, SitemapEntry
        from apps.seo.serializers import SEOMetadataSerializer
        from apps.seo.services import refresh_seo_score

        course = self.get_object()
        ct = ContentType.objects.get_for_model(Course)
        defaults = {
            "slug": course.slug,
            "canonical_url": f"/courses/{course.slug}",
            "meta_title": (course.title or "")[:70],
            "meta_description": (course.short_description or course.description or "")[:320],
            "og_title": (course.title or "")[:100],
            "og_description": (course.short_description or course.description or "")[:320],
            "is_indexed": bool(course.is_published),
            "robots": "index,follow" if course.is_published else "noindex,nofollow",
        }
        meta, _created = SEOMetadata.objects.get_or_create(
            content_type=ct,
            object_id=str(course.pk),
            defaults=defaults,
        )

        if request.method in ("PUT", "PATCH"):
            if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
                return Response(
                    {"detail": "Only admins can update course SEO."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            serializer = SEOMetadataSerializer(
                meta,
                data=request.data,
                partial=True,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            meta = serializer.save()
            # Keep path identity in sync with the course
            meta.slug = course.slug
            if not meta.canonical_url:
                meta.canonical_url = f"/courses/{course.slug}"
            meta.save(update_fields=["slug", "canonical_url", "updated_at"])
            refresh_seo_score(meta, save=True)
            SitemapEntry.objects.update_or_create(
                url_path=f"/courses/{course.slug}",
                defaults={
                    "priority": 0.85,
                    "changefreq": SitemapEntry.ChangeFreq.WEEKLY,
                    "is_active": bool(course.is_published and meta.is_indexed),
                },
            )
            return success_response(
                data=SEOMetadataSerializer(meta, context={"request": request}).data,
                message="Course SEO updated.",
            )

        return success_response(
            data=SEOMetadataSerializer(meta, context={"request": request}).data,
            message="Course SEO retrieved.",
        )

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, slug=None):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can publish courses."},
                status=status.HTTP_403_FORBIDDEN,
            )
        course = self.get_object()
        course.is_published = True
        course.status = Course.Status.PUBLISHED
        course.save(update_fields=["is_published", "status", "updated_at"])
        # Ensure SEO row exists for public course pages
        try:
            from django.contrib.contenttypes.models import ContentType

            from apps.seo.models import SEOMetadata, SitemapEntry

            ct = ContentType.objects.get_for_model(Course)
            SEOMetadata.objects.get_or_create(
                content_type=ct,
                object_id=str(course.pk),
                defaults={
                    "slug": course.slug,
                    "canonical_url": f"/courses/{course.slug}",
                    "meta_title": (course.title or "")[:70],
                    "meta_description": (course.short_description or course.description or "")[:320],
                    "is_indexed": True,
                    "robots": "index,follow",
                },
            )
            SitemapEntry.objects.update_or_create(
                url_path=f"/courses/{course.slug}",
                defaults={
                    "priority": 0.85,
                    "changefreq": SitemapEntry.ChangeFreq.WEEKLY,
                    "is_active": True,
                },
            )
        except Exception:
            pass
        return Response(CourseSerializer(course, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, slug=None):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can unpublish courses."},
                status=status.HTTP_403_FORBIDDEN,
            )
        course = self.get_object()
        course.is_published = False
        course.status = Course.Status.DRAFT
        course.save(update_fields=["is_published", "status", "updated_at"])
        return Response(CourseSerializer(course, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="upload-thumbnail")
    def upload_thumbnail(self, request, slug=None):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can upload course thumbnails."},
                status=status.HTTP_403_FORBIDDEN,
            )
        course = self.get_object()
        file = request.FILES.get("thumbnail")
        if not file:
            return Response({"detail": "No thumbnail file provided."}, status=status.HTTP_400_BAD_REQUEST)
        from django.core.exceptions import ValidationError as DjangoValidationError

        from apps.common.file_validators import validate_uploaded_file

        try:
            validate_uploaded_file(file, kind="image")
        except DjangoValidationError as exc:
            return Response(
                {"detail": "; ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        course.thumbnail = file
        course.save(update_fields=["thumbnail", "updated_at"])
        return Response(CourseSerializer(course, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="featured")
    def featured(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(is_featured=True, is_published=True))
        page = self.paginate_queryset(qs)
        serializer = CourseListSerializer(page or qs, many=True, context={"request": request})
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class CourseInstructorViewSet(viewsets.ModelViewSet):
    queryset = CourseInstructor.objects.select_related(
        "course",
        "teacher",
        "teacher__user",
    )
    serializer_class = CourseInstructorSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnlyCourse]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CourseInstructorFilter
    search_fields = [
        "teacher__teacher_id",
        "teacher__user__email",
        "teacher__user__first_name",
        "teacher__user__last_name",
        "course__title",
    ]
    ordering_fields = ["assigned_at", "is_primary"]
    ordering = ["-is_primary", "-assigned_at"]

    def create(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can assign instructors."},
                status=status.HTTP_403_FORBIDDEN,
            )
        logger.info(
            "CourseInstructor.create: teacher=%s course=%s is_primary=%s user=%s",
            request.data.get("teacher"),
            request.data.get("course"),
            request.data.get("is_primary"),
            getattr(request.user, "email", request.user.pk),
        )
        response = super().create(request, *args, **kwargs)
        logger.info(
            "CourseInstructor.create: saved status=%s body=%s",
            response.status_code,
            response.data,
        )
        return response

    def destroy(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can remove instructors."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

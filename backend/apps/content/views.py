"""
DRF viewsets for the content CMS.
"""

import logging

from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from apps.cms.models import BlogPost, BlogSection
from apps.cms.permissions import IsAdminOrStaffWrite
from apps.cms.serializers import BlogSectionSerializer
from apps.common.media_cookie_auth import MediaCookieAuthentication
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, ROLE_TEACHER, user_has_role
from apps.content.filters import (
    BlogSectionFilter,
    ChapterFilter,
    ChapterProgressFilter,
    ClassScheduleFilter,
    CourseFAQFilter,
    CourseHighlightFilter,
    CourseProgressFilter,
    PartAttachmentFilter,
    PartFilter,
    PartResourceFilter,
    TopicFilter,
    VideoPartFilter,
    VideoTimestampFilter,
    StudentProgressFilter,
)
from apps.content.models import (
    Chapter,
    ChapterProgress,
    ClassSchedule,
    CourseFAQ,
    CourseProgress,
    Part,
    PartAttachment,
    PartResource,
    Topic,
    VideoPart,
    VideoTimestamp,
    StudentProgress,
)
from apps.content.permissions import (
    IsAdminOrTeacherContentManager,
    IsStudentOwnProgress,
    MediaStreamCookieRequired,
    _get_student_profile,
    user_teaches_course,
)
from apps.content.serializers import (
    ChapterListSerializer,
    ChapterProgressSerializer,
    ChapterSerializer,
    ClassScheduleSerializer,
    CourseFAQSerializer,
    CourseProgressSerializer,
    PartAttachmentSerializer,
    PartListSerializer,
    PartResourceSerializer,
    PartSerializer,
    TopicSerializer,
    VideoPartSerializer,
    VideoTimestampSerializer,
    StudentProgressSerializer,
    StudentProgressWriteSerializer,
)
from apps.content.schedule_utils import (
    can_manage_course_content,
    group_class_schedules,
    upcoming_class_schedules_qs,
)
from apps.content.services import update_student_progress
from apps.courses.models import Course, CourseHighlight
from apps.courses.serializers import CourseHighlightSerializer

logger = logging.getLogger(__name__)


class ChapterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ChapterFilter
    search_fields = ["title", "slug", "description"]
    ordering_fields = ["order", "title", "created_at", "duration_minutes"]
    ordering = ["order", "id"]

    def get_queryset(self):
        qs = Chapter.objects.select_related("course", "video").annotate(
            parts_count=Count("parts", distinct=True)
        ).prefetch_related(
            Prefetch(
                "parts",
                queryset=Part.objects.prefetch_related(
                    Prefetch("topics", queryset=Topic.objects.order_by("order", "id")),
                ).order_by("order", "id"),
            ),
            Prefetch(
                "video__video_parts",
                queryset=VideoPart.objects.order_by("order", "id"),
            )
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(course__instructors__teacher=teacher) | Q(course__created_by=user)
            ).distinct()
        # Students / others: published only
        return qs.filter(is_published=True).distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return ChapterListSerializer
        return ChapterSerializer

    def create(self, request, *args, **kwargs):
        if user_has_role(request.user, ROLE_TEACHER):
            course = Course.objects.filter(pk=request.data.get("course")).first()
            if course is None or not user_teaches_course(request.user, course):
                return Response(
                    {"detail": "You can only create content for courses you teach."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        logger.info(
            "content.chapter.create user=%s payload_keys=%s course=%s title=%s",
            getattr(request.user, "email", request.user.pk),
            list(request.data.keys()) if hasattr(request.data, "keys") else None,
            request.data.get("course"),
            request.data.get("title"),
        )
        response = super().create(request, *args, **kwargs)
        logger.info(
            "content.chapter.create saved status=%s id=%s",
            response.status_code,
            (response.data or {}).get("id")
            if isinstance(response.data, dict)
            else None,
        )
        return response

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Help confirm refresh fetch returns nested parts
        payload = response.data
        rows = payload
        if isinstance(payload, dict):
            rows = payload.get("results") or payload.get("data") or payload
            if isinstance(rows, dict):
                rows = rows.get("results") or []
        count = len(rows) if isinstance(rows, list) else None
        parts_total = 0
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict):
                    parts_total += len(row.get("parts") or [])
        logger.info(
            "content.chapter.list user=%s chapters=%s nested_parts=%s",
            getattr(request.user, "email", request.user.pk),
            count,
            parts_total,
        )
        return response


class PartViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PartFilter
    search_fields = ["title", "slug", "description", "notes"]
    ordering_fields = ["order", "title", "created_at", "estimated_minutes"]
    ordering = ["order", "id"]

    def get_queryset(self):
        qs = Part.objects.select_related("chapter", "chapter__course").prefetch_related(
            Prefetch(
                "resources",
                queryset=PartResource.objects.prefetch_related(
                    Prefetch(
                        "timestamps",
                        queryset=VideoTimestamp.objects.order_by("time_seconds", "id"),
                    )
                ).order_by("order", "id"),
            ),
            "attachments",
            Prefetch("video_parts", queryset=VideoPart.objects.order_by("order", "id")),
            Prefetch("topics", queryset=Topic.objects.order_by("order", "id")),
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(chapter__course__instructors__teacher=teacher)
                | Q(chapter__course__created_by=user)
            ).distinct()
        # Students see published parts (or preview)
        return qs.filter(is_published=True, chapter__is_published=True)

    def get_serializer_class(self):
        if self.action == "list":
            return PartListSerializer
        return PartSerializer

    def create(self, request, *args, **kwargs):
        if user_has_role(request.user, ROLE_TEACHER):
            chapter = Chapter.objects.select_related("course").filter(pk=request.data.get("chapter")).first()
            course = getattr(chapter, "course", None)
            if chapter is None or course is None or not user_teaches_course(request.user, course):
                return Response(
                    {"detail": "You can only create content for courses you teach."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        logger.info(
            "content.part.create user=%s chapter=%s title=%s content_type=%s",
            getattr(request.user, "email", request.user.pk),
            request.data.get("chapter"),
            request.data.get("title"),
            request.data.get("content_type"),
        )
        response = super().create(request, *args, **kwargs)
        logger.info(
            "content.part.create saved status=%s id=%s",
            response.status_code,
            (response.data or {}).get("id")
            if isinstance(response.data, dict)
            else None,
        )
        return response

    @action(detail=True, methods=["get", "post"], url_path="topics")
    def topics(self, request, pk=None):
        """List or create topics nested under this part."""
        part = self.get_object()
        if request.method == "POST":
            if user_has_role(request.user, ROLE_TEACHER) and not user_has_role(
                request.user, ROLE_ADMIN, ROLE_STAFF
            ):
                course = getattr(part.chapter, "course", None)
                if course is None or not user_teaches_course(request.user, course):
                    return Response(
                        {"detail": "You can only create content for courses you teach."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            serializer = TopicSerializer(
                data=request.data,
                context={"request": request, "part": part},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save(part=part)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        topics = part.topics.order_by("order", "id")
        return Response(TopicSerializer(topics, many=True, context={"request": request}).data)


class TopicViewSet(viewsets.ModelViewSet):
    serializer_class = TopicSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TopicFilter
    search_fields = ["title"]
    ordering_fields = ["order", "title", "created_at"]
    ordering = ["order", "id"]
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = Topic.objects.select_related(
            "part",
            "part__chapter",
            "part__chapter__course",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(part__chapter__course__instructors__teacher=teacher)
                | Q(part__chapter__course__created_by=user)
            ).distinct()
        return qs.filter(
            part__is_published=True,
            part__chapter__is_published=True,
        )


class CourseClassScheduleListCreateView(APIView):
    """
    GET/POST /api/v1/content/courses/<course_id>/class-schedules/

    GET returns upcoming sessions grouped by date. POST creates one time slot.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminOrTeacherContentManager()]

    def _course(self, course_id):
        course = get_object_or_404(Course, pk=course_id)
        user = self.request.user
        if can_manage_course_content(user, course):
            return course
        if not course.is_published or course.status != Course.Status.PUBLISHED:
            raise NotFound()
        return course

    def get(self, request, course_id):
        course = self._course(course_id)
        qs = upcoming_class_schedules_qs(course, request.user)
        return Response(group_class_schedules(qs))

    def post(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not can_manage_course_content(request.user, course):
            return Response(
                {"detail": "You can only create content for courses you teach."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ClassScheduleSerializer(
            data=request.data,
            context={"request": request, "course": course},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(course=course)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClassScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ClassScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ClassScheduleFilter
    ordering_fields = ["date", "start_time", "created_at"]
    ordering = ["date", "start_time", "id"]
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = ClassSchedule.objects.select_related("course")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(course__instructors__teacher=teacher) | Q(course__created_by=user)
            ).distinct()
        today = timezone.localdate()
        now_time = timezone.localtime().time()
        return qs.filter(
            is_published=True,
            course__is_published=True,
        ).filter(Q(date__gt=today) | Q(date=today, end_time__gte=now_time))


class CourseHighlightListCreateView(APIView):
    """GET/POST /api/v1/content/courses/<course_id>/highlights/"""

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminOrTeacherContentManager()]

    def _course(self, course_id):
        course = get_object_or_404(Course, pk=course_id)
        user = self.request.user
        if can_manage_course_content(user, course):
            return course
        if not course.is_published or course.status != Course.Status.PUBLISHED:
            raise NotFound()
        return course

    def get(self, request, course_id):
        course = self._course(course_id)
        qs = CourseHighlight.objects.filter(course=course).order_by("order", "created_at")
        return Response(
            CourseHighlightSerializer(qs, many=True, context={"request": request}).data
        )

    def post(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not can_manage_course_content(request.user, course):
            return Response(
                {"detail": "You can only create content for courses you teach."},
                status=status.HTTP_403_FORBIDDEN,
            )
        logger.info(
            "CourseHighlight.create course=%s keys=%s heading=%r desc_len=%s order=%s user=%s",
            course.pk,
            sorted(getattr(request.data, "keys", lambda: [])()),
            request.data.get("heading") or request.data.get("title"),
            len(str(request.data.get("description") or request.data.get("text") or "")),
            request.data.get("order"),
            getattr(request.user, "email", request.user.pk),
        )
        serializer = CourseHighlightSerializer(
            data=request.data,
            context={"request": request, "course": course},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(course=course)
        logger.info(
            "CourseHighlight.created id=%s course=%s heading=%r",
            instance.pk,
            course.pk,
            instance.heading,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CourseHighlightViewSet(viewsets.ModelViewSet):
    serializer_class = CourseHighlightSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CourseHighlightFilter
    search_fields = ["heading", "description"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order", "created_at"]
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = CourseHighlight.objects.select_related("course")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(course__instructors__teacher=teacher) | Q(course__created_by=user)
            ).distinct()
        return qs.filter(course__is_published=True, course__status=Course.Status.PUBLISHED)


class CourseFAQListCreateView(APIView):
    """GET/POST /api/v1/content/courses/<course_id>/faqs/"""

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminOrTeacherContentManager()]

    def _course(self, course_id):
        course = get_object_or_404(Course, pk=course_id)
        user = self.request.user
        if can_manage_course_content(user, course):
            return course
        if not course.is_published or course.status != Course.Status.PUBLISHED:
            raise NotFound()
        return course

    def get(self, request, course_id):
        course = self._course(course_id)
        qs = CourseFAQ.objects.filter(course=course).order_by("order", "created_at")
        return Response(
            CourseFAQSerializer(qs, many=True, context={"request": request}).data
        )

    def post(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not can_manage_course_content(request.user, course):
            return Response(
                {"detail": "You can only create content for courses you teach."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CourseFAQSerializer(
            data=request.data,
            context={"request": request, "course": course},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(course=course)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CourseFAQViewSet(viewsets.ModelViewSet):
    serializer_class = CourseFAQSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CourseFAQFilter
    search_fields = ["question", "answer"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order", "created_at"]
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = CourseFAQ.objects.select_related("course")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(course__instructors__teacher=teacher) | Q(course__created_by=user)
            ).distinct()
        return qs.filter(course__is_published=True, course__status=Course.Status.PUBLISHED)


class BlogPostSectionListCreateView(APIView):
    """GET/POST /api/v1/content/blog-posts/<post_id>/sections/"""

    permission_classes = [IsAdminOrStaffWrite]

    def _blog_post(self, post_id):
        post = get_object_or_404(BlogPost, pk=post_id)
        user = self.request.user
        if user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return post
        if not post.is_published:
            raise NotFound()
        return post

    def get(self, request, post_id):
        post = self._blog_post(post_id)
        qs = BlogSection.objects.filter(blog_post=post).order_by("order", "created_at")
        return Response(
            BlogSectionSerializer(qs, many=True, context={"request": request}).data
        )

    def post(self, request, post_id):
        post = get_object_or_404(BlogPost, pk=post_id)
        serializer = BlogSectionSerializer(
            data=request.data,
            context={"request": request, "blog_post": post},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(blog_post=post)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BlogPostSectionDetailView(APIView):
    """GET/PATCH/PUT/DELETE /api/v1/content/blog-posts/<post_id>/sections/<section_id>/"""

    permission_classes = [IsAdminOrStaffWrite]

    def _section(self, post_id, section_id):
        user = self.request.user
        qs = BlogSection.objects.select_related("blog_post")
        if not (
            user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF)
        ):
            qs = qs.filter(blog_post__is_published=True)
        return get_object_or_404(qs, pk=section_id, blog_post_id=post_id)

    def get(self, request, post_id, section_id):
        section = self._section(post_id, section_id)
        return Response(
            BlogSectionSerializer(section, context={"request": request}).data
        )

    def patch(self, request, post_id, section_id):
        return self._update(request, post_id, section_id, partial=True)

    def put(self, request, post_id, section_id):
        return self._update(request, post_id, section_id, partial=False)

    def _update(self, request, post_id, section_id, *, partial):
        section = self._section(post_id, section_id)
        serializer = BlogSectionSerializer(
            section,
            data=request.data,
            partial=partial,
            context={"request": request, "blog_post": section.blog_post},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, post_id, section_id):
        section = self._section(post_id, section_id)
        section.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BlogSectionViewSet(viewsets.ModelViewSet):
    serializer_class = BlogSectionSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BlogSectionFilter
    search_fields = ["title", "description"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order", "created_at"]
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = BlogSection.objects.select_related("blog_post")
        user = self.request.user
        if user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(blog_post__is_published=True)


class PartResourceViewSet(viewsets.ModelViewSet):
    serializer_class = PartResourceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PartResourceFilter
    search_fields = ["title", "external_url"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order"]

    def get_queryset(self):
        qs = PartResource.objects.select_related(
            "part", "part__chapter", "part__chapter__course"
        ).prefetch_related(
            Prefetch(
                "timestamps",
                queryset=VideoTimestamp.objects.order_by("time_seconds", "id"),
            )
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(part__chapter__course__instructors__teacher=teacher)
                | Q(part__chapter__course__created_by=user)
            ).distinct()
        return qs.filter(
            part__is_published=True,
            part__chapter__is_published=True,
        )

    @action(
        detail=True,
        methods=["get", "head"],
        url_path="stream",
        authentication_classes=[MediaCookieAuthentication],
        permission_classes=[MediaStreamCookieRequired],
        # Never serve the browsable API HTML explorer for media probes.
        renderer_classes=[JSONRenderer],
    )
    def stream(self, request, pk=None):
        """
        GET /api/v1/content/resources/<id>/stream/

        Strict in-app media delivery:
        * Auth via httpOnly ``sl_media_session`` cookie only (never query tokens,
          never Authorization header, never presigned S3 URLs).
        * Missing/invalid auth or missing permission → opaque 404.
        * Server-side fetch from storage + stream (supports HTTP Range / 206).
        """
        from apps.content.media_stream import build_resource_stream_response
        from apps.content.resource_signed_urls import (
            resource_playable_file_name,
            user_can_access_resource,
        )

        # Explicitly ignore any URL credentials (?access_token=, ?token=, etc.).
        # Authentication is cookie-only via MediaCookieAuthentication.
        try:
            resource = PartResource.objects.select_related(
                "part", "part__chapter", "part__chapter__course"
            ).get(pk=pk)
        except PartResource.DoesNotExist:
            raise NotFound()

        if not user_can_access_resource(request.user, resource):
            raise NotFound()

        if not resource_playable_file_name(resource):
            raise NotFound()

        return build_resource_stream_response(request, resource)

    @action(
        detail=True,
        methods=["get"],
        url_path="stream-info",
        permission_classes=[IsAuthenticated],
    )
    def stream_info(self, request, pk=None):
        """
        Metadata for the frontend player (never includes a downloadable file URL).

        Returns the stream path. Clients must load it with the media cookie only —
        never expose a bucket / presigned / query-token URL.
        """
        from apps.content.resource_signed_urls import (
            detect_resource_media_type,
            resource_playable_file_name,
            user_can_access_resource,
        )

        try:
            resource = PartResource.objects.select_related(
                "part", "part__chapter", "part__chapter__course"
            ).get(pk=pk)
        except PartResource.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_resource(request.user, resource):
            return Response(
                {"detail": "You do not have permission to access this resource."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not resource_playable_file_name(resource):
            return Response(
                {"detail": "This resource has no downloadable file."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                "id": resource.pk,
                "type": detect_resource_media_type(resource),
                "stream_path": f"/api/v1/content/resources/{resource.pk}/stream/",
                "status": resource.status,
            }
        )

    def perform_create(self, serializer):
        resource = serializer.save()
        self._enqueue_video_compression(resource)
        # Ensure 201 body reflects processing (serializer.instance can be stale).
        resource.refresh_from_db()
        serializer.instance = resource

    def perform_update(self, serializer):
        previous_file = None
        if serializer.instance and serializer.instance.file:
            previous_file = serializer.instance.file.name
        resource = serializer.save()
        # Re-compress when a new video file is uploaded onto an existing resource.
        if (
            resource.resource_type == PartResource.ResourceType.VIDEO
            and resource.file
            and resource.file.name != previous_file
        ):
            self._enqueue_video_compression(resource, force_new_original=True)
            resource.refresh_from_db()
            serializer.instance = resource

    def _enqueue_video_compression(self, resource: PartResource, *, force_new_original: bool = False):
        if resource.resource_type != PartResource.ResourceType.VIDEO or not resource.file:
            if resource.status != PartResource.Status.READY:
                resource.status = PartResource.Status.READY
                resource.error_message = ""
                resource.save(update_fields=["status", "error_message", "updated_at"])
            return

        # Copy upload into a distinct original_file key so replacing ``file``
        # after compression cannot delete the source object.
        if force_new_original or not resource.original_file:
            from pathlib import Path

            from django.core.files.base import ContentFile

            src_name = Path(resource.file.name).name
            with resource.file.open("rb") as fh:
                resource.original_file.save(src_name, ContentFile(fh.read()), save=False)

        resource.status = PartResource.Status.PROCESSING
        resource.error_message = ""
        resource.save()

        from apps.content.tasks import compress_part_resource_video

        try:
            compress_part_resource_video.delay(resource.pk)
            logger.info(
                "content.resource.compress_enqueued id=%s file=%s original=%s",
                resource.pk,
                resource.file.name,
                resource.original_file.name if resource.original_file else None,
            )
        except Exception:
            logger.exception("content.resource.compress_enqueue_failed id=%s", resource.pk)
            resource.status = PartResource.Status.FAILED
            resource.error_message = "Could not enqueue video compression. Is Celery running?"
            resource.save(update_fields=["status", "error_message", "updated_at"])

    @action(detail=True, methods=["get"], url_path="status")
    def processing_status(self, request, pk=None):
        resource = self.get_object()
        return Response(
            {
                "id": resource.pk,
                "status": resource.status,
                "error_message": resource.error_message,
                "duration_seconds": resource.duration_seconds,
                "ready": resource.status == PartResource.Status.READY,
            }
        )

    @action(detail=True, methods=["post"], url_path="retry-compression")
    def retry_compression(self, request, pk=None):
        resource = self.get_object()
        if resource.resource_type != PartResource.ResourceType.VIDEO:
            return Response(
                {"detail": "Only VIDEO resources can be compressed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (resource.original_file or resource.file):
            return Response(
                {"detail": "No video file available to compress."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user_has_role(request.user, ROLE_TEACHER) and not user_has_role(
            request.user, ROLE_ADMIN, ROLE_STAFF
        ):
            course = getattr(getattr(resource.part, "chapter", None), "course", None)
            if course is None or not user_teaches_course(request.user, course):
                return Response(
                    {"detail": "You can only retry compression for courses you teach."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        self._enqueue_video_compression(resource)
        resource.refresh_from_db()
        return Response(
            {
                "id": resource.pk,
                "status": resource.status,
                "error_message": resource.error_message,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get", "post"], url_path="timestamps")
    def timestamps(self, request, pk=None):
        resource = self.get_object()
        if request.method == "GET":
            qs = resource.timestamps.order_by("time_seconds", "id")
            return Response(VideoTimestampSerializer(qs, many=True).data)

        if user_has_role(request.user, ROLE_TEACHER) and not user_has_role(
            request.user, ROLE_ADMIN, ROLE_STAFF
        ):
            course = getattr(getattr(resource.part, "chapter", None), "course", None)
            if course is None or not user_teaches_course(request.user, course):
                return Response(
                    {"detail": "You can only create timestamps for courses you teach."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = VideoTimestampSerializer(
            data=request.data,
            context={"request": request, "resource": resource},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(resource=resource)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PartAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = PartAttachmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PartAttachmentFilter
    search_fields = ["title", "file_type"]
    ordering_fields = ["created_at", "file_size"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = PartAttachment.objects.select_related("part", "part__chapter", "part__chapter__course")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(part__chapter__course__instructors__teacher=teacher)
                | Q(part__chapter__course__created_by=user)
            ).distinct()
        return qs.filter(
            part__is_published=True,
            part__chapter__is_published=True,
        )


class VideoPartViewSet(viewsets.ModelViewSet):
    serializer_class = VideoPartSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = VideoPartFilter
    search_fields = ["title"]
    ordering_fields = ["order", "start_time", "end_time", "created_at"]
    ordering = ["order", "id"]

    def get_queryset(self):
        qs = VideoPart.objects.select_related("video", "video__chapter", "video__chapter__course")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(video__chapter__course__instructors__teacher=teacher)
                | Q(video__chapter__course__created_by=user)
            ).distinct()
        return qs.filter(
            video__is_published=True,
            video__chapter__is_published=True,
        )

    def create(self, request, *args, **kwargs):
        if user_has_role(request.user, ROLE_TEACHER):
            video = Part.objects.select_related("chapter", "chapter__course").filter(pk=request.data.get("video")).first()
            course = getattr(getattr(video, "chapter", None), "course", None)
            if video is None or course is None or not user_teaches_course(request.user, course):
                return Response(
                    {"detail": "You can only create content for courses you teach."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        return super().create(request, *args, **kwargs)


class VideoTimestampViewSet(viewsets.ModelViewSet):
    serializer_class = VideoTimestampSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = VideoTimestampFilter
    search_fields = ["label"]
    ordering_fields = ["time_seconds", "order", "created_at"]
    ordering = ["time_seconds", "id"]
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = VideoTimestamp.objects.select_related(
            "resource",
            "resource__part",
            "resource__part__chapter",
            "resource__part__chapter__course",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(resource__part__chapter__course__instructors__teacher=teacher)
                | Q(resource__part__chapter__course__created_by=user)
            ).distinct()
        return qs.filter(
            resource__part__is_published=True,
            resource__part__chapter__is_published=True,
        )


class StudentProgressViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsStudentOwnProgress]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = StudentProgressFilter
    search_fields = ["part__title", "status"]
    ordering_fields = ["updated_at", "progress_percent", "completed_at"]
    ordering = ["-updated_at"]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        qs = StudentProgress.objects.select_related(
            "student",
            "part",
            "chapter",
            "course",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(course__instructors__teacher=teacher) | Q(course__created_by=user)
            ).distinct()
        student = _get_student_profile(user)
        if student is None:
            return qs.none()
        return qs.filter(student=student)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update", "upsert"):
            return StudentProgressWriteSerializer
        return StudentProgressSerializer

    def create(self, request, *args, **kwargs):
        return self._upsert(request)

    def update(self, request, *args, **kwargs):
        return self._upsert(request, instance=self.get_object())

    def partial_update(self, request, *args, **kwargs):
        return self._upsert(request, instance=self.get_object())

    @action(detail=False, methods=["post"], url_path="upsert")
    def upsert(self, request):
        return self._upsert(request)

    def _upsert(self, request, instance=None):
        if not user_has_role(request.user, ROLE_STUDENT, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only students can update progress."},
                status=status.HTTP_403_FORBIDDEN,
            )

        student = _get_student_profile(request.user)
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF) and not student:
            # Admin may pass student id explicitly
            student_id = request.data.get("student")
            if student_id:
                from apps.students.models import Student

                student = Student.objects.filter(pk=student_id).first()
        if student is None:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = StudentProgressWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        part = data["part"]
        if instance is not None:
            part = instance.part

        progress = update_student_progress(
            student=student,
            part=part,
            status=data.get("status"),
            progress_percent=data.get("progress_percent"),
            last_position_seconds=data.get("last_position_seconds"),
        )
        return Response(
            StudentProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


class ChapterProgressViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ChapterProgressSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = ChapterProgressFilter
    ordering_fields = ["progress_percent", "updated_at", "completed_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = ChapterProgress.objects.select_related("student", "chapter")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(chapter__course__instructors__teacher=teacher)
                | Q(chapter__course__created_by=user)
            ).distinct()
        student = _get_student_profile(user)
        if student is None:
            return qs.none()
        return qs.filter(student=student)


class CourseProgressViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CourseProgressSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = CourseProgressFilter
    ordering_fields = ["progress_percent", "last_accessed_at", "updated_at"]
    ordering = ["-last_accessed_at"]

    def get_queryset(self):
        qs = CourseProgress.objects.select_related("student", "course")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(course__instructors__teacher=teacher) | Q(course__created_by=user)
            ).distinct()
        student = _get_student_profile(user)
        if student is None:
            return qs.none()
        return qs.filter(student=student)

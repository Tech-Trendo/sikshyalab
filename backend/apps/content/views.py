"""
DRF viewsets for the content CMS.
"""

from django.db.models import Count, Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, ROLE_TEACHER, user_has_role
from apps.content.filters import (
    ChapterFilter,
    ChapterProgressFilter,
    CourseProgressFilter,
    PartAttachmentFilter,
    PartFilter,
    PartResourceFilter,
    StudentProgressFilter,
)
from apps.content.models import (
    Chapter,
    ChapterProgress,
    CourseProgress,
    Part,
    PartAttachment,
    PartResource,
    StudentProgress,
)
from apps.content.permissions import (
    IsAdminOrTeacherContentManager,
    IsStudentOwnProgress,
    _get_student_profile,
)
from apps.content.serializers import (
    ChapterListSerializer,
    ChapterProgressSerializer,
    ChapterSerializer,
    CourseProgressSerializer,
    PartAttachmentSerializer,
    PartListSerializer,
    PartResourceSerializer,
    PartSerializer,
    StudentProgressSerializer,
    StudentProgressWriteSerializer,
)
from apps.content.services import update_student_progress


class ChapterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ChapterFilter
    search_fields = ["title", "slug", "description"]
    ordering_fields = ["order", "title", "created_at", "duration_minutes"]
    ordering = ["order"]

    def get_queryset(self):
        qs = Chapter.objects.select_related("course").annotate(
            parts_count=Count("parts", distinct=True)
        ).prefetch_related(
            Prefetch(
                "parts",
                queryset=Part.objects.order_by("order"),
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


class PartViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PartFilter
    search_fields = ["title", "slug", "description", "notes"]
    ordering_fields = ["order", "title", "created_at", "estimated_minutes"]
    ordering = ["order"]

    def get_queryset(self):
        qs = Part.objects.select_related("chapter", "chapter__course").prefetch_related(
            "resources",
            "attachments",
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


class PartResourceViewSet(viewsets.ModelViewSet):
    serializer_class = PartResourceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherContentManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PartResourceFilter
    search_fields = ["title", "external_url"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order"]

    def get_queryset(self):
        qs = PartResource.objects.select_related("part", "part__chapter", "part__chapter__course")
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

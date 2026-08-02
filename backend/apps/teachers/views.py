"""
API views for the teachers app.
"""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, user_has_role
from apps.teachers.filters import (
    TeacherDocumentFilter,
    TeacherFilter,
    TeacherQualificationFilter,
    TeacherScheduleFilter,
    TeacherWorkloadFilter,
)
from apps.teachers.models import (
    Teacher,
    TeacherDocument,
    TeacherExperience,
    TeacherQualification,
    TeacherSchedule,
    TeacherWorkload,
)
from apps.teachers.permissions import IsAdminOrTeacherOwn, IsAdminOrTeacherOwnRelated
from apps.teachers.serializers import (
    TeacherDocumentSerializer,
    TeacherExperienceSerializer,
    TeacherListSerializer,
    TeacherQualificationSerializer,
    TeacherScheduleSerializer,
    TeacherSerializer,
    TeacherWorkloadSerializer,
)


def _own_teacher(user):
    return getattr(user, "teacher_profile", None)


class TeacherViewSet(viewsets.ModelViewSet):
    """
    Admin: full CRUD.
    Teacher: manage own profile; list/retrieve others.
    """

    permission_classes = [IsAuthenticated, IsAdminOrTeacherOwn]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TeacherFilter
    search_fields = [
        "teacher_id",
        "employee_id",
        "designation",
        "department",
        "user__email",
        "user__first_name",
        "user__last_name",
        "bio",
    ]
    ordering_fields = [
        "created_at",
        "joining_date",
        "teacher_id",
        "years_of_experience",
        "status",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Teacher.objects.select_related("user").prefetch_related(
            "qualifications",
            "experiences",
            "documents",
            "schedules",
        )

    def get_serializer_class(self):
        if self.action == "list":
            return TeacherListSerializer
        return TeacherSerializer

    def destroy(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can delete teacher profiles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if user_has_role(request.user, ROLE_TEACHER) and not user_has_role(
            request.user, ROLE_ADMIN, ROLE_STAFF
        ):
            if instance.user_id != request.user.id:
                raise PermissionDenied("Teachers may only update their own profile.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can create teacher profiles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        teacher = _own_teacher(request.user)
        if teacher is None:
            return Response(
                {"detail": "No teacher profile found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        teacher = self.get_queryset().get(pk=teacher.pk)
        if request.method == "GET":
            return Response(TeacherSerializer(teacher, context={"request": request}).data)
        serializer = TeacherSerializer(
            teacher,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class _TeacherOwnedMixin:
    """Scope queryset and enforce ownership on create for related teacher resources."""

    ownership_required_on_write = True

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            # Teachers see all on read; writes restricted to own via perform_create/object perms
            if self.request.method in ("GET", "HEAD", "OPTIONS"):
                return qs
            return qs.filter(teacher__user=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        teacher = serializer.validated_data.get("teacher")
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            serializer.save()
            return
        if user_has_role(user, ROLE_TEACHER):
            own = _own_teacher(user)
            if own is None or teacher != own:
                raise PermissionDenied(
                    "Teachers may only create records for their own profile."
                )
            serializer.save()
            return
        raise PermissionDenied("Not allowed.")


class TeacherQualificationViewSet(_TeacherOwnedMixin, viewsets.ModelViewSet):
    queryset = TeacherQualification.objects.select_related("teacher", "teacher__user")
    serializer_class = TeacherQualificationSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherOwnRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TeacherQualificationFilter
    search_fields = ["degree", "institution", "field"]
    ordering_fields = ["year", "degree", "created_at"]
    ordering = ["-year"]


class TeacherExperienceViewSet(_TeacherOwnedMixin, viewsets.ModelViewSet):
    queryset = TeacherExperience.objects.select_related("teacher", "teacher__user")
    serializer_class = TeacherExperienceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherOwnRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["teacher", "is_current", "organization"]
    search_fields = ["organization", "position", "description"]
    ordering_fields = ["from_date", "to_date", "created_at"]
    ordering = ["-is_current", "-from_date"]


class TeacherDocumentViewSet(_TeacherOwnedMixin, viewsets.ModelViewSet):
    queryset = TeacherDocument.objects.select_related("teacher", "teacher__user")
    serializer_class = TeacherDocumentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherOwnRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TeacherDocumentFilter
    search_fields = ["title"]
    ordering_fields = ["uploaded_at", "doc_type", "created_at"]
    ordering = ["-uploaded_at"]


class TeacherScheduleViewSet(_TeacherOwnedMixin, viewsets.ModelViewSet):
    queryset = TeacherSchedule.objects.select_related(
        "teacher",
        "teacher__user",
        "course",
        "batch",
    )
    serializer_class = TeacherScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherOwnRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TeacherScheduleFilter
    search_fields = ["notes"]
    ordering_fields = ["day_of_week", "start_time", "created_at"]
    ordering = ["day_of_week", "start_time"]


class TeacherWorkloadViewSet(_TeacherOwnedMixin, viewsets.ModelViewSet):
    queryset = TeacherWorkload.objects.select_related("teacher", "teacher__user")
    serializer_class = TeacherWorkloadSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherOwnRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TeacherWorkloadFilter
    search_fields = ["notes"]
    ordering_fields = ["year", "month", "hours_assigned", "hours_completed"]
    ordering = ["-year", "-month"]

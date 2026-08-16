"""
API views for the teachers app.
"""

import logging

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, user_has_role
from apps.courses.models import Course, CourseInstructor
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

logger = logging.getLogger(__name__)


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
            "course_assignments__course",
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
        # PATCH must be treated as partial. If we call `update()` instead,
        # DRF will treat it as a full update and may require required fields
        # like `teacher_id`.
        return super().partial_update(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can create teacher profiles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    @staticmethod
    def _ensure_course_assignment(teacher, course, *, make_primary=True):
        """Create or restore a CourseInstructor row; optionally mark as primary."""
        existing = (
            CourseInstructor.all_objects.filter(course=course, teacher=teacher)
            .order_by("-updated_at")
            .first()
        )
        if existing is None:
            assignment = CourseInstructor.objects.create(
                course=course,
                teacher=teacher,
                is_primary=make_primary,
            )
            created = True
        else:
            assignment = existing
            created = False
            if assignment.is_deleted:
                assignment.restore()
            if make_primary and not assignment.is_primary:
                assignment.is_primary = True
                assignment.save(update_fields=["is_primary", "updated_at"])
            elif make_primary:
                assignment.save(update_fields=["updated_at"])

        if make_primary:
            CourseInstructor.objects.filter(course=course, is_primary=True).exclude(
                pk=assignment.pk
            ).update(is_primary=False)

        return assignment, created

    @action(detail=True, methods=["post"], url_path="assign-courses")
    def assign_courses(self, request, pk=None):
        """
        Persist teacher ↔ course assignments via CourseInstructor.

        Body: { "course_ids": ["uuid", ...], "replace": true }
        When replace is true (default), the teacher's course set becomes exactly
        the provided ids. When false, courses are added without removing others.
        """
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can assign courses to teachers."},
                status=status.HTTP_403_FORBIDDEN,
            )

        teacher = self.get_object()
        raw_ids = request.data.get("course_ids", [])
        if not isinstance(raw_ids, list):
            return Response(
                {"course_ids": ["Expected a list of course UUIDs."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        replace = request.data.get("replace", True)
        if isinstance(replace, str):
            replace = replace.lower() not in ("0", "false", "no")

        course_ids = [str(cid).strip() for cid in raw_ids if cid]
        logger.info(
            "assign_courses: teacher_id=%s course_ids=%s replace=%s user=%s",
            teacher.pk,
            course_ids,
            replace,
            getattr(request.user, "email", request.user.pk),
        )

        courses = list(Course.objects.filter(pk__in=course_ids))
        found = {str(c.pk) for c in courses}
        missing = [cid for cid in course_ids if cid not in found]
        if missing:
            return Response(
                {"course_ids": [f"Unknown course id(s): {', '.join(missing)}"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                if replace:
                    keep = {c.pk for c in courses}
                    removed = CourseInstructor.objects.filter(teacher=teacher).exclude(
                        course_id__in=keep
                    )
                    removed_count = removed.count()
                    removed.delete()
                    logger.info(
                        "assign_courses: soft-deleted %s prior assignment(s) for teacher=%s",
                        removed_count,
                        teacher.pk,
                    )

                created_ids = []
                restored_ids = []
                for course in courses:
                    assignment, created = self._ensure_course_assignment(
                        teacher, course, make_primary=True
                    )
                    if created:
                        created_ids.append(str(course.pk))
                    else:
                        restored_ids.append(str(course.pk))

                teacher = self.get_queryset().get(pk=teacher.pk)
                payload = TeacherSerializer(
                    teacher, context={"request": request}
                ).data
                logger.info(
                    "assign_courses: save ok teacher=%s created=%s restored=%s assigned=%s",
                    teacher.pk,
                    created_ids,
                    restored_ids,
                    payload.get("assigned_course_ids"),
                )
                return Response(payload, status=status.HTTP_200_OK)
        except Exception:
            logger.exception(
                "assign_courses: failed teacher_id=%s course_ids=%s",
                teacher.pk,
                course_ids,
            )
            raise

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

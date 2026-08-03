"""
API views for the students app.
"""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.responses import success_response
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, ROLE_TEACHER, user_has_role
from apps.students.filters import (
    AcademicHistoryFilter,
    GuardianFilter,
    StudentDocumentFilter,
    StudentFilter,
)
from apps.students.models import (
    AcademicHistory,
    Guardian,
    Student,
    StudentActivityLog,
    StudentDocument,
)
from apps.students.permissions import (
    IsAdminOrReadOnlyActivityLog,
    IsAdminOrStudentOwnerRelated,
    IsAdminOrTeacherReadStudentWriteOwn,
)
from apps.students.serializers import (
    AcademicHistorySerializer,
    GuardianSerializer,
    StudentActivityLogSerializer,
    StudentDocumentSerializer,
    StudentListSerializer,
    StudentSerializer,
)
from apps.students.services import deactivate_student, reactivate_student


class StudentViewSet(viewsets.ModelViewSet):
    """
    CRUD for student profiles.

    Admin: full access.
    Teacher: list / retrieve.
    Student: retrieve / update own profile; ``GET /me/`` shortcut.
    """

    permission_classes = [IsAuthenticated, IsAdminOrTeacherReadStudentWriteOwn]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = StudentFilter
    search_fields = [
        "student_id",
        "enrollment_number",
        "user__email",
        "user__first_name",
        "user__last_name",
        "city",
        "district",
    ]
    ordering_fields = [
        "created_at",
        "admission_date",
        "student_id",
        "status",
        "user__first_name",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Student.objects.select_related("user").prefetch_related(
            "guardians",
            "academic_history",
            "documents",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_STUDENT):
            return qs.filter(user=user)
        if user_has_role(user, ROLE_TEACHER):
            # Teachers: only students in batches they teach (matches frontend)
            return qs.filter(batch_memberships__batch__teacher__user=user).distinct()
        return qs.none()

    def get_serializer_class(self):
        if self.action == "list":
            return StudentListSerializer
        return StudentSerializer

    def perform_create(self, serializer):
        student = serializer.save()
        StudentActivityLog.objects.create(
            student=student,
            action="student.created",
            description="Student profile created.",
            performed_by=self.request.user,
        )

    def perform_update(self, serializer):
        student = serializer.save()
        StudentActivityLog.objects.create(
            student=student,
            action="student.updated",
            description="Student profile updated.",
            performed_by=self.request.user,
        )

    def destroy(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can delete student profiles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = self.get_object()
        StudentActivityLog.objects.create(
            student=instance,
            action="student.deleted",
            description="Student profile soft-deleted.",
            performed_by=request.user,
        )
        deactivate_student(instance, performed_by=request.user)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        """Admin-only: set status INACTIVE, revoke tokens, notify student."""
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can deactivate students."},
                status=status.HTTP_403_FORBIDDEN,
            )
        student = self.get_object()
        if student.status == Student.Status.INACTIVE:
            return success_response(
                data=StudentSerializer(student, context={"request": request}).data,
                message="Student is already deactivated.",
            )
        student = deactivate_student(student, performed_by=request.user)
        return success_response(
            data=StudentSerializer(student, context={"request": request}).data,
            message="Student account deactivated successfully.",
        )

    @action(detail=True, methods=["post"], url_path="reactivate")
    def reactivate(self, request, pk=None):
        """Admin-only: set status ACTIVE and notify student."""
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can reactivate students."},
                status=status.HTTP_403_FORBIDDEN,
            )
        student = self.get_object()
        if student.status == Student.Status.ACTIVE:
            return success_response(
                data=StudentSerializer(student, context={"request": request}).data,
                message="Student is already active.",
            )
        student = reactivate_student(student, performed_by=request.user)
        return success_response(
            data=StudentSerializer(student, context={"request": request}).data,
            message="Student account reactivated successfully.",
        )

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        """Return or partially update the authenticated student's own profile."""
        try:
            student = Student.objects.select_related("user").prefetch_related(
                "guardians",
                "academic_history",
                "documents",
            ).get(user=request.user)
        except Student.DoesNotExist:
            return Response(
                {"detail": "No student profile found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if request.method == "GET":
            return Response(StudentSerializer(student, context={"request": request}).data)
        serializer = StudentSerializer(
            student,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)


class GuardianViewSet(viewsets.ModelViewSet):
    serializer_class = GuardianSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStudentOwnerRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = GuardianFilter
    search_fields = ["name", "phone", "email", "occupation"]
    ordering_fields = ["name", "is_primary", "created_at"]
    ordering = ["-is_primary", "name"]

    def get_queryset(self):
        qs = Guardian.objects.select_related("student", "student__user")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_STUDENT):
            return qs.filter(student__user=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        student = serializer.validated_data.get("student")
        if user_has_role(user, ROLE_STUDENT):
            own = getattr(user, "student_profile", None)
            if own is None or student != own:
                raise PermissionDenied(
                    "Students may only add guardians to their own profile."
                )
        serializer.save()


class AcademicHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = AcademicHistorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrStudentOwnerRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AcademicHistoryFilter
    search_fields = ["institution", "degree_level", "field_of_study"]
    ordering_fields = ["year_to", "year_from", "created_at"]
    ordering = ["-year_to"]

    def get_queryset(self):
        qs = AcademicHistory.objects.select_related("student", "student__user")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_STUDENT):
            return qs.filter(student__user=user)
        return qs


class StudentDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentDocumentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStudentOwnerRelated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = StudentDocumentFilter
    search_fields = ["title", "notes"]
    ordering_fields = ["created_at", "issued_date", "doc_type"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = StudentDocument.objects.select_related("student", "student__user")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_STUDENT):
            return qs.filter(student__user=user)
        return qs


class StudentActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only activity logs; admins may also create via POST if needed."""

    serializer_class = StudentActivityLogSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnlyActivityLog]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student", "action", "performed_by"]
    search_fields = ["action", "description"]
    ordering_fields = ["created_at", "action"]
    ordering = ["-created_at"]
    http_method_names = ["get", "head", "options", "post"]

    def get_queryset(self):
        qs = StudentActivityLog.objects.select_related(
            "student",
            "student__user",
            "performed_by",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_STUDENT):
            return qs.filter(student__user=user)
        return qs

    def create(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return Response(
                {"detail": "Only admins can create activity logs."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(performed_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

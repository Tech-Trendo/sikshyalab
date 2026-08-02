"""
DRF viewsets for enrollments.
"""

from django.db.models import Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, ROLE_TEACHER, user_has_role
from apps.enrollments.filters import (
    EnrollmentDocumentFilter,
    EnrollmentFilter,
    EnrollmentHistoryFilter,
)
from apps.enrollments.models import Enrollment, EnrollmentDocument, EnrollmentHistory
from apps.enrollments.permissions import EnrollmentPermission, _get_student, _get_teacher
from apps.enrollments.serializers import (
    EnrollmentActionSerializer,
    EnrollmentDocumentSerializer,
    EnrollmentHistorySerializer,
    EnrollmentListSerializer,
    EnrollmentSerializer,
)
from apps.enrollments.services import (
    approve_enrollment,
    cancel_enrollment,
    complete_enrollment,
    reject_enrollment,
)


class EnrollmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, EnrollmentPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = EnrollmentFilter
    search_fields = [
        "enrollment_number",
        "student__student_id",
        "course__title",
        "notes",
    ]
    ordering_fields = [
        "created_at",
        "enrolled_at",
        "status",
        "final_amount",
        "enrollment_number",
    ]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        qs = Enrollment.objects.select_related(
            "student",
            "student__user",
            "course",
            "batch",
            "shift",
            "approved_by",
        ).prefetch_related(
            "documents",
            Prefetch("history", queryset=EnrollmentHistory.objects.select_related("changed_by")),
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = _get_teacher(user)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(batch__teacher=teacher)
                | Q(course__instructors__teacher=teacher)
                | Q(course__created_by=user)
            ).distinct()
        if user_has_role(user, ROLE_STUDENT):
            student = _get_student(user)
            if student is None:
                return qs.none()
            return qs.filter(student=student)
        return qs.none()

    def get_serializer_class(self):
        if self.action == "list":
            return EnrollmentListSerializer
        if self.action in ("approve", "reject", "cancel", "complete"):
            return EnrollmentActionSerializer
        return EnrollmentSerializer

    def perform_create(self, serializer):
        user = self.request.user
        extra = {}
        if user_has_role(user, ROLE_STUDENT) and not user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            student = _get_student(user)
            if student is None:
                raise PermissionError("Student profile required.")
            extra["student"] = student
        serializer.save(**extra)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def _action_response(self, enrollment):
        return Response(EnrollmentSerializer(enrollment, context={"request": self.request}).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        enrollment = self.get_object()
        serializer = EnrollmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            enrollment = approve_enrollment(
                enrollment,
                changed_by=request.user,
                remark=serializer.validated_data.get("remark", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return self._action_response(enrollment)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        enrollment = self.get_object()
        serializer = EnrollmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = (
            serializer.validated_data.get("reason")
            or serializer.validated_data.get("remark")
            or ""
        )
        try:
            enrollment = reject_enrollment(
                enrollment,
                changed_by=request.user,
                reason=reason,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return self._action_response(enrollment)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        enrollment = self.get_object()
        serializer = EnrollmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            enrollment = cancel_enrollment(
                enrollment,
                changed_by=request.user,
                remark=serializer.validated_data.get("remark", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return self._action_response(enrollment)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        enrollment = self.get_object()
        serializer = EnrollmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            enrollment = complete_enrollment(
                enrollment,
                changed_by=request.user,
                remark=serializer.validated_data.get("remark", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return self._action_response(enrollment)


class EnrollmentHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EnrollmentHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = EnrollmentHistoryFilter
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = EnrollmentHistory.objects.select_related(
            "enrollment",
            "changed_by",
            "enrollment__student",
            "enrollment__course",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = _get_teacher(user)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(enrollment__batch__teacher=teacher)
                | Q(enrollment__course__instructors__teacher=teacher)
                | Q(enrollment__course__created_by=user)
            ).distinct()
        if user_has_role(user, ROLE_STUDENT):
            student = _get_student(user)
            if student is None:
                return qs.none()
            return qs.filter(enrollment__student=student)
        return qs.none()


class EnrollmentDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = EnrollmentDocumentSerializer
    permission_classes = [IsAuthenticated, EnrollmentPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = EnrollmentDocumentFilter
    search_fields = ["title", "doc_type"]
    ordering_fields = ["created_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = EnrollmentDocument.objects.select_related(
            "enrollment",
            "enrollment__student",
            "enrollment__course",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = _get_teacher(user)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(enrollment__batch__teacher=teacher)
                | Q(enrollment__course__instructors__teacher=teacher)
                | Q(enrollment__course__created_by=user)
            ).distinct()
        if user_has_role(user, ROLE_STUDENT):
            student = _get_student(user)
            if student is None:
                return qs.none()
            return qs.filter(enrollment__student=student)
        return qs.none()

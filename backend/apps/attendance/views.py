"""DRF viewsets for attendance (read / reports only — marking removed)."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated

from apps.attendance.models import (
    AttendanceSession,
    MonthlyAttendanceSummary,
    StudentAttendance,
    TeacherAttendance,
)
from apps.attendance.permissions import (
    CanViewOwnAttendance,
    get_student_for_user,
    get_teacher_for_user,
)
from apps.attendance.serializers import (
    AttendanceSessionSerializer,
    MonthlyAttendanceSummarySerializer,
    MonthlyReportQuerySerializer,
    StudentAttendanceSerializer,
    TeacherAttendanceSerializer,
    build_student_monthly_summary,
    build_teacher_monthly_summary,
)
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import error_response, success_response


class StudentAttendanceViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Read-only student attendance (marking removed from product)."""

    serializer_class = StudentAttendanceSerializer
    permission_classes = [IsAuthenticated, CanViewOwnAttendance]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student", "batch", "course", "date", "status"]
    search_fields = ["remarks", "student__user__email"]
    ordering_fields = ["date", "created_at", "status"]
    ordering = ["-date"]

    def get_queryset(self):
        qs = StudentAttendance.objects.select_related(
            "student", "batch", "course", "marked_by"
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(batch__teacher=teacher)
        student = get_student_for_user(user)
        if student:
            return qs.filter(student=student)
        return qs.none()

    @action(detail=False, methods=["get"], url_path="monthly-report")
    def monthly_report(self, request):
        query = MonthlyReportQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        year = query.validated_data["year"]
        month = query.validated_data["month"]
        student_id = query.validated_data.get("student")
        batch_id = query.validated_data.get("batch")

        user = request.user
        student = None
        if student_id is None:
            student = get_student_for_user(user)
            if student is None:
                return error_response(message="student query param is required.")
        else:
            from django.apps import apps as django_apps

            Student = django_apps.get_model("students", "Student")
            try:
                student = Student.objects.get(pk=student_id)
            except Student.DoesNotExist:
                return error_response(message="Student not found.", status_code=404)
            if not user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
                own = get_student_for_user(user)
                teacher = get_teacher_for_user(user)
                if own is None or own.pk != student.pk:
                    if teacher is None:
                        return error_response(message="Not allowed.", status_code=403)

        summary = build_student_monthly_summary(student, month, year, batch_id=batch_id)
        return success_response(data=MonthlyAttendanceSummarySerializer(summary).data)


class TeacherAttendanceViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Read-only teacher attendance (marking removed from product)."""

    serializer_class = TeacherAttendanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["teacher", "date", "status"]
    search_fields = ["remarks", "teacher__user__email"]
    ordering_fields = ["date", "created_at", "status"]
    ordering = ["-date"]

    def get_queryset(self):
        qs = TeacherAttendance.objects.select_related("teacher", "marked_by")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(teacher=teacher)
        return qs.none()

    @action(detail=False, methods=["get"], url_path="monthly-report")
    def monthly_report(self, request):
        query = MonthlyReportQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        year = query.validated_data["year"]
        month = query.validated_data["month"]
        teacher_id = query.validated_data.get("teacher")
        user = request.user
        teacher = None
        if teacher_id is None:
            teacher = get_teacher_for_user(user)
            if teacher is None:
                return error_response(message="teacher query param is required.")
        else:
            from django.apps import apps as django_apps

            Teacher = django_apps.get_model("teachers", "Teacher")
            try:
                teacher = Teacher.objects.get(pk=teacher_id)
            except Teacher.DoesNotExist:
                return error_response(message="Teacher not found.", status_code=404)
            if not user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
                own = get_teacher_for_user(user)
                if own is None or own.pk != teacher.pk:
                    return error_response(message="Not allowed.", status_code=403)
        summary = build_teacher_monthly_summary(teacher, month, year)
        return success_response(data=MonthlyAttendanceSummarySerializer(summary).data)


class AttendanceSessionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AttendanceSessionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["batch", "course", "date", "status"]
    search_fields = ["notes"]
    ordering_fields = ["date", "created_at"]
    ordering = ["-date"]

    def get_queryset(self):
        qs = AttendanceSession.objects.select_related("batch", "course", "taken_by")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(batch__teacher=teacher)
        return qs.none()


class MonthlyAttendanceSummaryViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = MonthlyAttendanceSummarySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["student", "teacher", "year", "month", "summary_type"]
    ordering_fields = ["year", "month", "created_at"]
    ordering = ["-year", "-month"]

    def get_queryset(self):
        qs = MonthlyAttendanceSummary.objects.select_related("student", "teacher")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        student = get_student_for_user(user)
        if student:
            return qs.filter(student=student)
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(teacher=teacher)
        return qs.none()

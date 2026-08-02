"""
Analytics API endpoints.

Admin: full platform stats.
Teacher: own course/batch scoped stats (via services.teacher_scope_filters).
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.analytics.models import SavedReport
from apps.analytics.permissions import (
    IsAdminAnalytics,
    IsAdminOrTeacherAnalytics,
    IsDashboardUser,
    IsStudentDashboard,
    IsTeacherDashboard,
)
from apps.analytics.serializers import SavedReportSerializer
from apps.analytics import services as analytics_services
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import created_response, success_response


def _months_param(request, default=12, maximum=36) -> int:
    try:
        months = int(request.query_params.get("months", default))
    except (TypeError, ValueError):
        months = default
    return max(1, min(months, maximum))


def _days_param(request, default=30, maximum=365) -> int:
    try:
        days = int(request.query_params.get("days", default))
    except (TypeError, ValueError):
        days = default
    return max(1, min(days, maximum))


class AnalyticsViewSet(viewsets.ViewSet):
    """
    Analytics endpoints under /api/v1/analytics/.

    - GET dashboard/
    - GET enrollments/trends/?months=12
    - GET students/growth/
    - GET revenue/summary/
    - GET attendance/reports/
    - GET assignments/completion/
    - GET certificates/stats/
    - GET teachers/performance/
    """

    permission_classes = [IsAuthenticated, IsDashboardUser]

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        data = analytics_services.dashboard_stats(user=request.user)
        return success_response(data=data, message="Dashboard analytics.")

    @action(detail=False, methods=["get"], url_path="enrollments/trends")
    def enrollment_trends(self, request):
        months = _months_param(request)
        data = analytics_services.enrollment_trends(months=months, user=request.user)
        return success_response(
            data={"months": months, "series": data},
            message="Enrollment trends.",
        )

    @action(detail=False, methods=["get"], url_path="students/growth")
    def student_growth(self, request):
        months = _months_param(request)
        data = analytics_services.student_growth(months=months, user=request.user)
        return success_response(
            data={"months": months, "series": data},
            message="Student growth.",
        )

    @action(detail=False, methods=["get"], url_path="revenue/summary")
    def revenue_summary(self, request):
        months = _months_param(request)
        data = analytics_services.revenue_summary(months=months, user=request.user)
        return success_response(data=data, message="Revenue summary.")

    @action(detail=False, methods=["get"], url_path="attendance/reports")
    def attendance_reports(self, request):
        days = _days_param(request)
        data = analytics_services.attendance_reports(user=request.user, days=days)
        return success_response(data=data, message="Attendance reports.")

    @action(detail=False, methods=["get"], url_path="assignments/completion")
    def assignment_completion(self, request):
        data = analytics_services.assignment_completion(user=request.user)
        return success_response(data=data, message="Assignment completion.")

    @action(detail=False, methods=["get"], url_path="certificates/stats")
    def certificate_stats(self, request):
        data = analytics_services.certificate_stats(user=request.user)
        return success_response(data=data, message="Certificate stats.")

    @action(detail=False, methods=["get"], url_path="teachers/performance")
    def teacher_performance(self, request):
        data = analytics_services.teacher_performance(user=request.user)
        return success_response(
            data={"teachers": data},
            message="Teacher performance.",
        )


# Explicit APIView aliases so urls can also mount path-style routes
# matching the requested /api/v1/analytics/<resource>/ shape.


class DashboardAnalyticsView(APIView):
    """Role-aware dashboard: admin / teacher / student payloads."""

    permission_classes = [IsAuthenticated, IsDashboardUser]

    def get(self, request):
        return success_response(
            data=analytics_services.dashboard_stats(user=request.user),
            message="Dashboard analytics.",
        )


class AdminDashboardAnalyticsView(APIView):
    """Admin-only overview summary cards."""

    permission_classes = [IsAuthenticated, IsAdminAnalytics]

    def get(self, request):
        return success_response(
            data=analytics_services.admin_dashboard_summary(),
            message="Admin dashboard summary.",
        )


class TeacherDashboardAnalyticsView(APIView):
    """Teacher-only overview summary cards."""

    permission_classes = [IsAuthenticated, IsTeacherDashboard]

    def get(self, request):
        return success_response(
            data=analytics_services.teacher_dashboard_summary(user=request.user),
            message="Teacher dashboard summary.",
        )


class StudentDashboardAnalyticsView(APIView):
    """Student-only overview summary cards."""

    permission_classes = [IsAuthenticated, IsStudentDashboard]

    def get(self, request):
        return success_response(
            data=analytics_services.student_dashboard_summary(user=request.user),
            message="Student dashboard summary.",
        )


class EnrollmentTrendsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]

    def get(self, request):
        months = _months_param(request)
        return success_response(
            data={
                "months": months,
                "series": analytics_services.enrollment_trends(
                    months=months, user=request.user
                ),
            },
            message="Enrollment trends.",
        )


class StudentGrowthView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]

    def get(self, request):
        months = _months_param(request)
        return success_response(
            data={
                "months": months,
                "series": analytics_services.student_growth(
                    months=months, user=request.user
                ),
            },
            message="Student growth.",
        )


class RevenueSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]

    def get(self, request):
        months = _months_param(request)
        return success_response(
            data=analytics_services.revenue_summary(months=months, user=request.user),
            message="Revenue summary.",
        )


class AttendanceReportsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]

    def get(self, request):
        days = _days_param(request)
        return success_response(
            data=analytics_services.attendance_reports(user=request.user, days=days),
            message="Attendance reports.",
        )


class AssignmentCompletionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]

    def get(self, request):
        return success_response(
            data=analytics_services.assignment_completion(user=request.user),
            message="Assignment completion.",
        )


class CertificateStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]

    def get(self, request):
        return success_response(
            data=analytics_services.certificate_stats(user=request.user),
            message="Certificate stats.",
        )


class TeacherPerformanceView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]

    def get(self, request):
        return success_response(
            data={"teachers": analytics_services.teacher_performance(user=request.user)},
            message="Teacher performance.",
        )


class SavedReportViewSet(viewsets.ModelViewSet):
    """Optional CRUD for saved report configurations."""

    serializer_class = SavedReportSerializer
    permission_classes = [IsAuthenticated, IsAdminOrTeacherAnalytics]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = SavedReport.objects.select_related("created_by")
        if getattr(self, "swagger_fake_view", False):
            return qs.none()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(created_by=user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return created_response(data=serializer.data, message="Report saved.")

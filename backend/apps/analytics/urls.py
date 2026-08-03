from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.analytics.views import (
    AdminDashboardAnalyticsView,
    AssignmentCompletionView,
    CertificateStatsView,
    DashboardAnalyticsView,
    EnrollmentTrendsView,
    RevenueSummaryView,
    SavedReportViewSet,
    StudentDashboardAnalyticsView,
    StudentGrowthView,
    TeacherDashboardAnalyticsView,
    TeacherPerformanceView,
)

app_name = "analytics"

router = DefaultRouter()
router.register(r"saved-reports", SavedReportViewSet, basename="saved-report")

urlpatterns = [
    path("dashboard/", DashboardAnalyticsView.as_view(), name="dashboard"),
    path("dashboard/admin/", AdminDashboardAnalyticsView.as_view(), name="dashboard-admin"),
    path(
        "dashboard/teacher/",
        TeacherDashboardAnalyticsView.as_view(),
        name="dashboard-teacher",
    ),
    path(
        "dashboard/student/",
        StudentDashboardAnalyticsView.as_view(),
        name="dashboard-student",
    ),
    path(
        "enrollments/trends/",
        EnrollmentTrendsView.as_view(),
        name="enrollment-trends",
    ),
    path("students/growth/", StudentGrowthView.as_view(), name="student-growth"),
    path("revenue/summary/", RevenueSummaryView.as_view(), name="revenue-summary"),
    path(
        "assignments/completion/",
        AssignmentCompletionView.as_view(),
        name="assignment-completion",
    ),
    path(
        "certificates/stats/",
        CertificateStatsView.as_view(),
        name="certificate-stats",
    ),
    path(
        "teachers/performance/",
        TeacherPerformanceView.as_view(),
        name="teacher-performance",
    ),
    path("", include(router.urls)),
]

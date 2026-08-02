from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.attendance.views import (
    AttendanceSessionViewSet,
    MonthlyAttendanceSummaryViewSet,
    StudentAttendanceViewSet,
    TeacherAttendanceViewSet,
)

app_name = "attendance"

router = DefaultRouter()
router.register(r"students", StudentAttendanceViewSet, basename="student-attendance")
router.register(r"teachers", TeacherAttendanceViewSet, basename="teacher-attendance")
router.register(r"sessions", AttendanceSessionViewSet, basename="attendance-session")
router.register(
    r"monthly-summaries",
    MonthlyAttendanceSummaryViewSet,
    basename="monthly-attendance-summary",
)

urlpatterns = [
    path("", include(router.urls)),
]

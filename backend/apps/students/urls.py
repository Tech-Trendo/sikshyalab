from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.students.views import (
    AcademicHistoryViewSet,
    GuardianViewSet,
    StudentActivityLogViewSet,
    StudentDocumentViewSet,
    StudentViewSet,
)

app_name = "students"

router = DefaultRouter()
router.register(r"profiles", StudentViewSet, basename="student")
router.register(r"guardians", GuardianViewSet, basename="guardian")
router.register(r"academic-history", AcademicHistoryViewSet, basename="academic-history")
router.register(r"documents", StudentDocumentViewSet, basename="student-document")
router.register(r"activity-logs", StudentActivityLogViewSet, basename="student-activity-log")

urlpatterns = [
    path("", include(router.urls)),
]

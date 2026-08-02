from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.enrollments.views import (
    EnrollmentDocumentViewSet,
    EnrollmentHistoryViewSet,
    EnrollmentViewSet,
)

app_name = "enrollments"

router = DefaultRouter()
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")
router.register(r"history", EnrollmentHistoryViewSet, basename="enrollment-history")
router.register(r"documents", EnrollmentDocumentViewSet, basename="enrollment-document")

urlpatterns = [
    path("", include(router.urls)),
]

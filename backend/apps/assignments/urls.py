from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.assignments.views import (
    AssignmentAllocationViewSet,
    AssignmentResourceViewSet,
    AssignmentViewSet,
    SubmissionReviewViewSet,
    SubmissionViewSet,
)

app_name = "assignments"

router = DefaultRouter()
router.register(r"assignments", AssignmentViewSet, basename="assignment")
router.register(r"resources", AssignmentResourceViewSet, basename="assignment-resource")
router.register(
    r"allocations",
    AssignmentAllocationViewSet,
    basename="assignment-allocation",
)
router.register(r"submissions", SubmissionViewSet, basename="submission")
router.register(r"reviews", SubmissionReviewViewSet, basename="submission-review")

urlpatterns = [
    path("", include(router.urls)),
]

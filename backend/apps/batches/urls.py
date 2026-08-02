from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.batches.views import (
    BatchScheduleViewSet,
    BatchStudentViewSet,
    BatchViewSet,
    ShiftViewSet,
)

app_name = "batches"

router = DefaultRouter()
router.register(r"shifts", ShiftViewSet, basename="shift")
router.register(r"batches", BatchViewSet, basename="batch")
router.register(r"batch-students", BatchStudentViewSet, basename="batch-student")
router.register(r"schedules", BatchScheduleViewSet, basename="batch-schedule")

urlpatterns = [
    path("", include(router.urls)),
]

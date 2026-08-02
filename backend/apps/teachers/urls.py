from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.teachers.views import (
    TeacherDocumentViewSet,
    TeacherExperienceViewSet,
    TeacherQualificationViewSet,
    TeacherScheduleViewSet,
    TeacherViewSet,
    TeacherWorkloadViewSet,
)

app_name = "teachers"

router = DefaultRouter()
router.register(r"profiles", TeacherViewSet, basename="teacher")
router.register(r"qualifications", TeacherQualificationViewSet, basename="teacher-qualification")
router.register(r"experiences", TeacherExperienceViewSet, basename="teacher-experience")
router.register(r"documents", TeacherDocumentViewSet, basename="teacher-document")
router.register(r"schedules", TeacherScheduleViewSet, basename="teacher-schedule")
router.register(r"workloads", TeacherWorkloadViewSet, basename="teacher-workload")

urlpatterns = [
    path("", include(router.urls)),
]

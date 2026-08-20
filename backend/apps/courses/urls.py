from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.courses.views import (
    CourseCategoryViewSet,
    CourseInstructorViewSet,
    CourseViewSet,
)

app_name = "courses"

router = DefaultRouter()
router.register(r"categories", CourseCategoryViewSet, basename="course-category")
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"instructors", CourseInstructorViewSet, basename="course-instructor")

urlpatterns = [
    path("", include(router.urls)),
]

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.content.views import (
    ChapterProgressViewSet,
    ChapterViewSet,
    CourseProgressViewSet,
    PartAttachmentViewSet,
    PartResourceViewSet,
    PartViewSet,
    VideoPartViewSet,
    VideoTimestampViewSet,
    StudentProgressViewSet,
)

app_name = "content"

router = DefaultRouter()
router.register(r"chapters", ChapterViewSet, basename="chapter")
router.register(r"parts", PartViewSet, basename="part")
router.register(r"resources", PartResourceViewSet, basename="part-resource")
router.register(r"attachments", PartAttachmentViewSet, basename="part-attachment")
router.register(r"video-parts", VideoPartViewSet, basename="video-part")
router.register(r"timestamps", VideoTimestampViewSet, basename="video-timestamp")
router.register(r"progress", StudentProgressViewSet, basename="student-progress")
router.register(r"chapter-progress", ChapterProgressViewSet, basename="chapter-progress")
router.register(r"course-progress", CourseProgressViewSet, basename="course-progress")

urlpatterns = [
    path("", include(router.urls)),
]

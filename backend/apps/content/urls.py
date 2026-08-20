from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.content.views import (
    BlogPostSectionDetailView,
    BlogPostSectionListCreateView,
    BlogSectionViewSet,
    ChapterProgressViewSet,
    ChapterViewSet,
    ClassScheduleViewSet,
    CourseClassScheduleListCreateView,
    CourseFAQListCreateView,
    CourseFAQViewSet,
    CourseHighlightListCreateView,
    CourseHighlightViewSet,
    CourseProgressViewSet,
    PartAttachmentViewSet,
    PartResourceViewSet,
    PartViewSet,
    TopicViewSet,
    VideoPartViewSet,
    VideoTimestampViewSet,
    StudentProgressViewSet,
)

app_name = "content"

router = DefaultRouter()
router.register(r"chapters", ChapterViewSet, basename="chapter")
router.register(r"parts", PartViewSet, basename="part")
router.register(r"topics", TopicViewSet, basename="topic")
router.register(r"class-schedules", ClassScheduleViewSet, basename="class-schedule")
router.register(r"course-faqs", CourseFAQViewSet, basename="course-faq")
router.register(r"highlights", CourseHighlightViewSet, basename="course-highlight")
router.register(r"blog-sections", BlogSectionViewSet, basename="blog-section")
router.register(r"resources", PartResourceViewSet, basename="part-resource")
router.register(r"attachments", PartAttachmentViewSet, basename="part-attachment")
router.register(r"video-parts", VideoPartViewSet, basename="video-part")
router.register(r"timestamps", VideoTimestampViewSet, basename="video-timestamp")
router.register(r"progress", StudentProgressViewSet, basename="student-progress")
router.register(r"chapter-progress", ChapterProgressViewSet, basename="chapter-progress")
router.register(r"course-progress", CourseProgressViewSet, basename="course-progress")

urlpatterns = [
    path(
        "courses/<uuid:course_id>/class-schedules/",
        CourseClassScheduleListCreateView.as_view(),
        name="course-class-schedules",
    ),
    path(
        "courses/<uuid:course_id>/highlights/",
        CourseHighlightListCreateView.as_view(),
        name="course-highlights",
    ),
    path(
        "courses/<uuid:course_id>/faqs/",
        CourseFAQListCreateView.as_view(),
        name="course-faqs",
    ),
    path(
        "blog-posts/<uuid:post_id>/sections/",
        BlogPostSectionListCreateView.as_view(),
        name="blog-post-sections",
    ),
    path(
        "blog-posts/<uuid:post_id>/sections/<uuid:section_id>/",
        BlogPostSectionDetailView.as_view(),
        name="blog-post-section-detail",
    ),
    path("", include(router.urls)),
]

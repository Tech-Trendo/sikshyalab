from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.cms.views import (
    AnnouncementViewSet,
    BannerViewSet,
    BlogPostViewSet,
    CareerViewSet,
    CMSTeacherHighlightViewSet,
    ContactMessageViewSet,
    CourseReviewViewSet,
    EventRegistrationViewSet,
    EventViewSet,
    FAQViewSet,
    GalleryItemViewSet,
    PageViewSet,
    PartnerViewSet,
    SiteSettingViewSet,
    TestimonialViewSet,
)

app_name = "cms"

router = DefaultRouter()
router.register(r"settings", SiteSettingViewSet, basename="site-setting")
router.register(r"banners", BannerViewSet, basename="banner")
router.register(r"pages", PageViewSet, basename="page")
router.register(r"blog", BlogPostViewSet, basename="blog-post")
router.register(r"events", EventViewSet, basename="event")
router.register(
    r"event-registrations",
    EventRegistrationViewSet,
    basename="event-registration",
)
router.register(r"gallery", GalleryItemViewSet, basename="gallery-item")
router.register(r"partners", PartnerViewSet, basename="partner")
router.register(r"testimonials", TestimonialViewSet, basename="testimonial")
router.register(r"reviews", CourseReviewViewSet, basename="course-review")
router.register(r"faqs", FAQViewSet, basename="faq")
router.register(r"careers", CareerViewSet, basename="career")
router.register(r"announcements", AnnouncementViewSet, basename="announcement")
router.register(r"contact-messages", ContactMessageViewSet, basename="contact-message")
router.register(
    r"teacher-highlights",
    CMSTeacherHighlightViewSet,
    basename="teacher-highlight",
)

urlpatterns = [
    path("", include(router.urls)),
]

"""DRF viewsets for the website CMS (facade — implementations in viewsets/)."""

from apps.cms.viewsets import (
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
    PublishedPublicMixin,
    SiteSettingViewSet,
    TestimonialViewSet,
)

__all__ = [
    "AnnouncementViewSet",
    "BannerViewSet",
    "BlogPostViewSet",
    "CareerViewSet",
    "CMSTeacherHighlightViewSet",
    "ContactMessageViewSet",
    "CourseReviewViewSet",
    "EventRegistrationViewSet",
    "EventViewSet",
    "FAQViewSet",
    "GalleryItemViewSet",
    "PageViewSet",
    "PartnerViewSet",
    "PublishedPublicMixin",
    "SiteSettingViewSet",
    "TestimonialViewSet",
]

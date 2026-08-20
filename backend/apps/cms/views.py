"""DRF viewsets for the website CMS (facade — implementations in viewsets/)."""

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

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
from apps.common.recaptcha import recaptcha_configured, recaptcha_site_key
from apps.common.responses import success_response


class PublicConfigAPIView(APIView):
    """Public frontend config (safe values only — never the reCAPTCHA secret)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        site_key = recaptcha_site_key()
        enabled = recaptcha_configured() and bool(site_key)
        return success_response(
            data={
                "recaptcha_enabled": enabled,
                "recaptcha_site_key": site_key if enabled else None,
            }
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
    "PublicConfigAPIView",
    "SiteSettingViewSet",
    "TestimonialViewSet",
]

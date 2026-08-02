from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.certificates.views import (
    CertificateSettingsAPIView,
    CertificateTemplateViewSet,
    CertificateVerificationLogViewSet,
    CertificateVerifyAPIView,
    CertificateViewSet,
)

app_name = "certificates"

router = DefaultRouter()
router.register(r"templates", CertificateTemplateViewSet, basename="certificate-template")
router.register(r"logs", CertificateVerificationLogViewSet, basename="certificate-log")
router.register(r"", CertificateViewSet, basename="certificate")

urlpatterns = [
    path(
        "verify/<str:verification_code>/",
        CertificateVerifyAPIView.as_view(),
        name="certificate-verify",
    ),
    path(
        "settings/",
        CertificateSettingsAPIView.as_view(),
        name="certificate-settings",
    ),
    path("", include(router.urls)),
]

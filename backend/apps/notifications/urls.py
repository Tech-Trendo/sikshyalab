from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.notifications.views import (
    NotificationPreferenceViewSet,
    NotificationTemplateViewSet,
    NotificationViewSet,
)

app_name = "notifications"

router = DefaultRouter()
router.register(
    r"preferences",
    NotificationPreferenceViewSet,
    basename="notification-preference",
)
router.register(
    r"templates",
    NotificationTemplateViewSet,
    basename="notification-template",
)
router.register(r"", NotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
]

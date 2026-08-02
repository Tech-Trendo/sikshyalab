"""
Notification services package.

Preferred integration:
    from apps.notifications.services import notify_user, notify_users, mark_all_read
"""

from apps.notifications.services.analytics import NotificationAnalyticsService
from apps.notifications.services.browser import BrowserNotificationService
from apps.notifications.services.domain import (
    ensure_inbox_seeded,
    notify_assignment_created,
    notify_certificate_issued,
    notify_enrollment_approved,
    notify_password_changed,
    notify_payment_received,
    notify_welcome,
)
from apps.notifications.services.email import EmailNotificationService
from apps.notifications.services.notification import NotificationService
from apps.notifications.services.preferences import (
    NotificationPreferenceService,
    get_or_create_preferences,
)
from apps.notifications.services.templates import NotificationTemplateService
from apps.notifications.services.websocket import WebSocketNotificationService


def notify_user(user, title: str, message: str, notification_type: str = "SYSTEM", **kwargs):
    return NotificationService.create(user, title, message, notification_type, **kwargs)


def notify_users(users, title: str, message: str, notification_type: str = "SYSTEM", **kwargs):
    return NotificationService.notify_many(users, title, message, notification_type, **kwargs)


def mark_all_read(user) -> int:
    return NotificationService.mark_all_read(user)


def mark_notification_read(notification, user=None):
    return NotificationService.mark_read(notification, user=user)


__all__ = [
    "NotificationService",
    "EmailNotificationService",
    "BrowserNotificationService",
    "WebSocketNotificationService",
    "NotificationPreferenceService",
    "NotificationTemplateService",
    "NotificationAnalyticsService",
    "get_or_create_preferences",
    "notify_user",
    "notify_users",
    "mark_all_read",
    "mark_notification_read",
    "ensure_inbox_seeded",
    "notify_enrollment_approved",
    "notify_assignment_created",
    "notify_payment_received",
    "notify_certificate_issued",
    "notify_welcome",
    "notify_password_changed",
]

"""Browser push / client-side notification channel (metadata + WS payload)."""

from __future__ import annotations

from django.utils import timezone

from apps.notifications.models import Notification, NotificationDelivery, NotificationLog


class BrowserNotificationService:
    """
    Marks a BROWSER-channel delivery as ready for the client.

    Actual OS/browser Notification API is triggered by the dashboard after
    receiving the WebSocket / REST payload with ``channel=BROWSER``.
    """

    channel = Notification.Channel.BROWSER

    @classmethod
    def deliver(cls, notification: Notification) -> bool:
        delivery, _ = NotificationDelivery.objects.get_or_create(
            notification=notification,
            channel=cls.channel,
            defaults={"status": NotificationDelivery.Status.PENDING},
        )
        delivery.attempt_count += 1
        delivery.last_attempt_at = timezone.now()
        delivery.status = NotificationDelivery.Status.DELIVERED
        delivery.delivered_at = timezone.now()
        delivery.provider = "browser_client"
        delivery.save(
            update_fields=[
                "attempt_count",
                "last_attempt_at",
                "status",
                "delivered_at",
                "provider",
                "updated_at",
            ]
        )
        NotificationLog.objects.create(
            notification=notification,
            action=NotificationLog.Action.DELIVERED,
            detail="Browser channel marked for client display",
        )
        return True

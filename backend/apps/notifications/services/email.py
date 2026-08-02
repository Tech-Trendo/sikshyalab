"""Email channel delivery."""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.notifications.models import Notification, NotificationDelivery, NotificationLog

logger = logging.getLogger(__name__)


class EmailNotificationService:
    channel = Notification.Channel.EMAIL

    @classmethod
    def deliver(cls, notification: Notification) -> bool:
        delivery, _ = NotificationDelivery.objects.get_or_create(
            notification=notification,
            channel=cls.channel,
            defaults={"status": NotificationDelivery.Status.PENDING},
        )
        delivery.attempt_count += 1
        delivery.last_attempt_at = timezone.now()
        delivery.status = NotificationDelivery.Status.QUEUED
        delivery.save(
            update_fields=["attempt_count", "last_attempt_at", "status", "updated_at"]
        )

        user = notification.recipient
        email = getattr(user, "email", None)
        if not email:
            delivery.status = NotificationDelivery.Status.SKIPPED
            delivery.error_message = "Recipient has no email"
            delivery.save(update_fields=["status", "error_message", "updated_at"])
            return False

        subject = notification.title
        body = notification.message
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@shikshalab.com"),
                recipient_list=[email],
                fail_silently=False,
            )
            delivery.status = NotificationDelivery.Status.SENT
            delivery.delivered_at = timezone.now()
            delivery.provider = "django_email"
            delivery.save(
                update_fields=[
                    "status",
                    "delivered_at",
                    "provider",
                    "updated_at",
                ]
            )
            if notification.status in (
                Notification.Status.PENDING,
                Notification.Status.QUEUED,
            ):
                notification.status = Notification.Status.SENT
                notification.save(update_fields=["status", "updated_at"])
            NotificationLog.objects.create(
                notification=notification,
                action=NotificationLog.Action.SENT,
                detail=f"Email sent to {email}",
            )
            return True
        except Exception as exc:
            logger.exception("Email delivery failed for notification=%s", notification.pk)
            delivery.status = NotificationDelivery.Status.FAILED
            delivery.error_message = str(exc)[:2000]
            delivery.save(update_fields=["status", "error_message", "updated_at"])
            notification.mark_failed(str(exc))
            NotificationLog.objects.create(
                notification=notification,
                action=NotificationLog.Action.FAILED,
                detail=str(exc)[:2000],
            )
            return False

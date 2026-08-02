"""
Core NotificationService — create, bulk-create, lifecycle, multi-channel dispatch.
"""

from __future__ import annotations

import logging
from typing import Any, Iterable

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.notifications.constants import category_for_event
from apps.notifications.models import Notification, NotificationDelivery, NotificationLog
from apps.notifications.services.browser import BrowserNotificationService
from apps.notifications.services.preferences import NotificationPreferenceService
from apps.notifications.services.templates import NotificationTemplateService
from apps.notifications.services.websocket import WebSocketNotificationService

logger = logging.getLogger(__name__)


class NotificationService:
    """Primary entry point for creating and managing notifications."""

    @staticmethod
    def _normalize_type(notification_type: str, event_code: str) -> str:
        if notification_type:
            return notification_type.upper()
        if event_code:
            return category_for_event(event_code)
        return Notification.NotificationType.SYSTEM

    @classmethod
    def create(
        cls,
        user,
        title: str,
        message: str,
        notification_type: str = "",
        *,
        event_code: str = "",
        channel: str = Notification.Channel.IN_APP,
        channels: list[str] | None = None,
        priority: str = Notification.Priority.MEDIUM,
        action_url: str = "",
        link: str = "",
        metadata: dict | None = None,
        related_object_type: str = "",
        related_object_id: str | int | None = "",
        actor=None,
        force: bool = False,
        template_code: str = "",
        context: dict | None = None,
        send_email: bool | None = None,
        push_realtime: bool = True,
    ) -> Notification | None:
        """
        Create an in-app notification and optionally queue other channels.

        ``channels`` may include EMAIL / BROWSER in addition to IN_APP.
        Email is always async via Celery when available.
        """
        if user is None:
            return None

        event_code = (event_code or template_code or "").upper()
        channel = (channel or Notification.Channel.IN_APP).upper()
        priority = (priority or Notification.Priority.MEDIUM).upper()
        url = action_url or link or ""

        if template_code or event_code:
            rendered = NotificationTemplateService.render(
                template_code or event_code, channel, context
            )
            if rendered:
                title = title or rendered["title"]
                message = message or rendered["message"]
                notification_type = notification_type or rendered["notification_type"]
                priority = priority or rendered["priority"]
                template = rendered.get("template")
            else:
                template = None
        else:
            template = None

        notification_type = cls._normalize_type(notification_type, event_code)

        if not force and not NotificationPreferenceService.is_allowed(
            user, channel, notification_type
        ):
            NotificationLog.objects.create(
                action=NotificationLog.Action.PREFERENCE_SKIPPED,
                detail=f"Skipped {channel}/{notification_type} for user {getattr(user, 'pk', None)}",
                metadata={"user_id": getattr(user, "pk", None)},
            )
            return None

        related_id = "" if related_object_id is None else str(related_object_id)
        is_critical = priority == Notification.Priority.CRITICAL

        notification = Notification.objects.create(
            recipient=user,
            actor=actor if getattr(actor, "pk", None) else None,
            title=title,
            message=message,
            notification_type=notification_type,
            event_code=event_code,
            channel=channel,
            priority=priority,
            status=Notification.Status.DELIVERED
            if channel == Notification.Channel.IN_APP
            else Notification.Status.PENDING,
            action_url=url,
            metadata=metadata or {},
            related_object_type=related_object_type or "",
            related_object_id=related_id,
            template=template,
            delivered_at=timezone.now()
            if channel == Notification.Channel.IN_APP
            else None,
        )
        NotificationLog.objects.create(
            notification=notification,
            actor=actor if getattr(actor, "pk", None) else None,
            action=NotificationLog.Action.CREATED,
            detail=f"Created via NotificationService ({channel})",
        )
        NotificationDelivery.objects.create(
            notification=notification,
            channel=channel,
            status=NotificationDelivery.Status.DELIVERED
            if channel == Notification.Channel.IN_APP
            else NotificationDelivery.Status.PENDING,
            delivered_at=timezone.now()
            if channel == Notification.Channel.IN_APP
            else None,
            provider="in_app" if channel == Notification.Channel.IN_APP else "",
        )

        extra_channels = set(channels or [])
        if send_email is True:
            extra_channels.add(Notification.Channel.EMAIL)
        elif send_email is None and (
            is_critical
            or NotificationPreferenceService.is_allowed(
                user, Notification.Channel.EMAIL, notification_type
            )
            and channel == Notification.Channel.EMAIL
        ):
            extra_channels.add(Notification.Channel.EMAIL)

        if Notification.Channel.BROWSER in extra_channels or channel == Notification.Channel.BROWSER:
            if force or NotificationPreferenceService.is_allowed(
                user, Notification.Channel.BROWSER, notification_type
            ):
                BrowserNotificationService.deliver(notification)

        if Notification.Channel.EMAIL in extra_channels or channel == Notification.Channel.EMAIL:
            if force or NotificationPreferenceService.is_allowed(
                user, Notification.Channel.EMAIL, notification_type
            ):
                cls.queue_email(notification.pk, critical=is_critical)

        if push_realtime and channel in (
            Notification.Channel.IN_APP,
            Notification.Channel.BROWSER,
        ):
            WebSocketNotificationService.push(notification)
            unread = Notification.objects.filter(
                recipient=user, is_read=False, is_archived=False
            ).count()
            WebSocketNotificationService.push_unread_count(user.pk, unread)

        return notification

    @staticmethod
    def queue_email(notification_id: int, *, critical: bool = False) -> None:
        try:
            from apps.notifications.tasks import deliver_email_notification

            if critical:
                deliver_email_notification.apply_async(
                    args=[notification_id], countdown=0, priority=9
                )
            else:
                deliver_email_notification.delay(notification_id)
        except Exception:
            # Celery unavailable — deliver inline (dev / tests)
            logger.debug("Celery unavailable; delivering email inline")
            from apps.notifications.services.email import EmailNotificationService
            from apps.notifications.models import Notification as N

            try:
                n = N.objects.get(pk=notification_id)
                EmailNotificationService.deliver(n)
            except N.DoesNotExist:
                pass

    @classmethod
    def notify_many(
        cls,
        users: QuerySet | Iterable,
        title: str,
        message: str,
        notification_type: str = Notification.NotificationType.SYSTEM,
        **kwargs: Any,
    ) -> list[Notification]:
        created: list[Notification] = []
        iterable = users.iterator() if hasattr(users, "iterator") else users
        bulk_rows: list[Notification] = []
        # Prefer per-user create to honor preferences + multi-channel;
        # bulk path only for force in-app mass inserts when requested.
        use_bulk = kwargs.pop("bulk", False) and kwargs.get("force") and not kwargs.get(
            "channels"
        )
        if use_bulk:
            notification_type = (notification_type or "SYSTEM").upper()
            channel = (kwargs.get("channel") or Notification.Channel.IN_APP).upper()
            priority = (kwargs.get("priority") or Notification.Priority.MEDIUM).upper()
            url = kwargs.get("action_url") or kwargs.get("link") or ""
            metadata = kwargs.get("metadata") or {}
            related_object_type = kwargs.get("related_object_type") or ""
            related_id = (
                ""
                if kwargs.get("related_object_id") is None
                else str(kwargs.get("related_object_id"))
            )
            event_code = (kwargs.get("event_code") or "").upper()
            actor = kwargs.get("actor")
            now = timezone.now()
            for user in iterable:
                if user is None:
                    continue
                bulk_rows.append(
                    Notification(
                        recipient=user,
                        actor=actor if getattr(actor, "pk", None) else None,
                        title=title,
                        message=message,
                        notification_type=notification_type,
                        event_code=event_code,
                        channel=channel,
                        priority=priority,
                        status=Notification.Status.DELIVERED,
                        action_url=url,
                        metadata=metadata,
                        related_object_type=related_object_type,
                        related_object_id=related_id,
                        delivered_at=now,
                    )
                )
            if bulk_rows:
                created = Notification.objects.bulk_create(bulk_rows, batch_size=500)
            return list(created)

        for user in iterable:
            n = cls.create(user, title, message, notification_type, **kwargs)
            if n is not None:
                created.append(n)
        return created

    @staticmethod
    @transaction.atomic
    def mark_all_read(user) -> int:
        now = timezone.now()
        updated = Notification.objects.filter(
            recipient=user, is_read=False, is_archived=False
        ).update(is_read=True, read_at=now, status=Notification.Status.READ)
        if updated:
            WebSocketNotificationService.push_unread_count(user.pk, 0)
        return updated

    @staticmethod
    def mark_read(notification: Notification, user=None) -> Notification:
        if user is not None and notification.recipient_id != getattr(user, "pk", None):
            raise PermissionError("Cannot mark another user's notification as read.")
        notification.mark_read()
        NotificationLog.objects.create(
            notification=notification,
            actor=user,
            action=NotificationLog.Action.READ,
        )
        unread = Notification.objects.filter(
            recipient_id=notification.recipient_id, is_read=False, is_archived=False
        ).count()
        WebSocketNotificationService.push_unread_count(notification.recipient_id, unread)
        return notification

    @staticmethod
    def archive(notification: Notification, user=None) -> Notification:
        if user is not None and notification.recipient_id != getattr(user, "pk", None):
            from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role

            if not user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
                raise PermissionError("Cannot archive another user's notification.")
        notification.archive()
        NotificationLog.objects.create(
            notification=notification,
            actor=user,
            action=NotificationLog.Action.ARCHIVED,
        )
        return notification

    @staticmethod
    def soft_delete(notification: Notification, user=None) -> None:
        if user is not None and notification.recipient_id != getattr(user, "pk", None):
            from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role

            if not user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
                raise PermissionError("Cannot delete another user's notification.")
        notification.delete()  # soft
        NotificationLog.objects.create(
            notification=None,
            actor=user,
            action=NotificationLog.Action.DELETED,
            detail=f"Soft-deleted notification id={notification.pk}",
            metadata={"notification_id": notification.pk},
        )

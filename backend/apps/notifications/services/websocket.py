"""Django Channels WebSocket fan-out for live notifications."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def user_group_name(user_id) -> str:
    return f"notifications_user_{user_id}"


class WebSocketNotificationService:
    @staticmethod
    def serialize_notification(notification) -> dict:
        return {
            "type": "notification.message",
            "event": "notification.created",
            "notification": {
                "id": notification.pk,
                "uuid": str(notification.uuid),
                "title": notification.title,
                "message": notification.message,
                "notification_type": notification.notification_type,
                "event_code": notification.event_code,
                "channel": notification.channel,
                "priority": notification.priority,
                "status": notification.status,
                "is_read": notification.is_read,
                "is_archived": notification.is_archived,
                "action_url": notification.action_url,
                "link": notification.action_url,
                "metadata": notification.metadata or {},
                "created_at": notification.created_at.isoformat()
                if notification.created_at
                else None,
            },
        }

    @classmethod
    def push(cls, notification) -> bool:
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
        except ImportError:
            logger.debug("channels not installed; skipping websocket push")
            return False

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return False

        payload = cls.serialize_notification(notification)
        try:
            async_to_sync(channel_layer.group_send)(
                user_group_name(notification.recipient_id),
                payload,
            )
            return True
        except Exception:
            logger.exception(
                "WebSocket push failed for notification=%s", notification.pk
            )
            return False

    @classmethod
    def push_unread_count(cls, user_id: int, count: int) -> bool:
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
        except ImportError:
            return False
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return False
        try:
            async_to_sync(channel_layer.group_send)(
                user_group_name(user_id),
                {
                    "type": "notification.message",
                    "event": "notification.unread_count",
                    "unread_count": count,
                },
            )
            return True
        except Exception:
            logger.exception("WebSocket unread_count push failed for user=%s", user_id)
            return False

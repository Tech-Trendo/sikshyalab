"""Notification preference helpers."""

from __future__ import annotations

import logging

from apps.notifications.models import Notification, NotificationPreference

logger = logging.getLogger(__name__)


class NotificationPreferenceService:
    @staticmethod
    def get_or_create(user) -> NotificationPreference:
        prefs, _ = NotificationPreference.objects.get_or_create(user=user)
        return prefs

    @staticmethod
    def is_allowed(user, channel: str, notification_type: str) -> bool:
        try:
            prefs = NotificationPreferenceService.get_or_create(user)
            return prefs.is_channel_allowed(channel, notification_type)
        except Exception:
            logger.exception(
                "Failed reading notification preferences for user=%s",
                getattr(user, "pk", None),
            )
            return channel == Notification.Channel.IN_APP

    @staticmethod
    def update(user, **fields) -> NotificationPreference:
        prefs = NotificationPreferenceService.get_or_create(user)
        allowed = {
            "email_enabled",
            "sms_enabled",
            "in_app_enabled",
            "browser_enabled",
            "digest_daily",
            "digest_weekly",
            "preferences",
        }
        update_fields = []
        for key, value in fields.items():
            if key in allowed:
                setattr(prefs, key, value)
                update_fields.append(key)
        if update_fields:
            prefs.save(update_fields=update_fields + ["updated_at"])
        return prefs


get_or_create_preferences = NotificationPreferenceService.get_or_create

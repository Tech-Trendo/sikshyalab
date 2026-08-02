"""
In-app / email / browser / SMS notification models for ShikshaLab.

Notification keeps a BigAutoField PK for backward compatibility with existing
rows and APIs. New related entities use UUID primary keys.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.common.mixins import SoftDeleteManager
from apps.common.models import SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class Notification(SoftDeleteModel):
    """A single notification delivered (or pending delivery) to a user."""

    class NotificationType(models.TextChoices):
        ENROLLMENT = "ENROLLMENT", _("Enrollment")
        ASSIGNMENT = "ASSIGNMENT", _("Assignment")
        PAYMENT = "PAYMENT", _("Payment")
        CERTIFICATE = "CERTIFICATE", _("Certificate")
        ATTENDANCE = "ATTENDANCE", _("Attendance")
        ANNOUNCEMENT = "ANNOUNCEMENT", _("Announcement")
        SYSTEM = "SYSTEM", _("System")
        ADMIN = "ADMIN", _("Admin")
        AUTH = "AUTH", _("Authentication")
        STUDENT = "STUDENT", _("Student")
        COURSE = "COURSE", _("Course")
        BATCH = "BATCH", _("Batch")
        EXAM = "EXAM", _("Exam")
        SECURITY = "SECURITY", _("Security")

    class Channel(models.TextChoices):
        IN_APP = "IN_APP", _("In-App")
        EMAIL = "EMAIL", _("Email")
        BROWSER = "BROWSER", _("Browser")
        SMS = "SMS", _("SMS")
        PUSH = "PUSH", _("Push")

    class Priority(models.TextChoices):
        CRITICAL = "CRITICAL", _("Critical")
        HIGH = "HIGH", _("High")
        MEDIUM = "MEDIUM", _("Medium")
        LOW = "LOW", _("Low")

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        QUEUED = "QUEUED", _("Queued")
        SENT = "SENT", _("Sent")
        DELIVERED = "DELIVERED", _("Delivered")
        READ = "READ", _("Read")
        FAILED = "FAILED", _("Failed")
        ARCHIVED = "ARCHIVED", _("Archived")

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_sent",
        help_text=_("User who triggered or authored this notification (if any)."),
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        db_index=True,
    )
    event_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text=_("Fine-grained event key, e.g. ASSIGNMENT_CREATED."),
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.IN_APP,
        db_index=True,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    is_read = models.BooleanField(default=False, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True, default="")
    action_url = models.CharField(
        max_length=500,
        blank=True,
        help_text=_("Deep-link or frontend route for this notification."),
    )
    metadata = models.JSONField(default=dict, blank=True)
    related_object_type = models.CharField(max_length=100, blank=True, db_index=True)
    related_object_id = models.CharField(max_length=64, blank=True, db_index=True)
    template = models.ForeignKey(
        "notifications.NotificationTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("notification")
        verbose_name_plural = _("notifications")
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
            models.Index(fields=["recipient", "is_archived", "-created_at"]),
            models.Index(fields=["notification_type", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["event_code", "-created_at"]),
            models.Index(fields=["related_object_type", "related_object_id"]),
            models.Index(fields=["priority", "status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} → {self.recipient}"

    @property
    def link(self):
        return self.action_url

    def mark_read(self, save=True):
        if self.is_read and self.status == self.Status.READ:
            return self
        self.is_read = True
        self.read_at = timezone.now()
        if self.status not in (self.Status.FAILED, self.Status.ARCHIVED):
            self.status = self.Status.READ
        if save:
            self.save(update_fields=["is_read", "read_at", "status", "updated_at"])
        return self

    def archive(self, save=True):
        self.is_archived = True
        self.archived_at = timezone.now()
        self.status = self.Status.ARCHIVED
        if save:
            self.save(
                update_fields=["is_archived", "archived_at", "status", "updated_at"]
            )
        return self

    def mark_delivered(self, save=True):
        self.status = self.Status.DELIVERED
        self.delivered_at = timezone.now()
        if save:
            self.save(update_fields=["status", "delivered_at", "updated_at"])
        return self

    def mark_failed(self, reason: str = "", save=True):
        self.status = self.Status.FAILED
        self.failed_at = timezone.now()
        self.failure_reason = (reason or "")[:2000]
        if save:
            self.save(
                update_fields=["status", "failed_at", "failure_reason", "updated_at"]
            )
        return self


class NotificationPreference(TimeStampedModel):
    """Per-user channel toggles and per-type / per-category preference map."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    in_app_enabled = models.BooleanField(default=True)
    browser_enabled = models.BooleanField(default=True)
    digest_daily = models.BooleanField(default=False)
    digest_weekly = models.BooleanField(default=True)
    preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text=_(
            "Per notification_type toggles, e.g. "
            '{"ASSIGNMENT": {"email": true, "in_app": true, "browser": true}}'
        ),
    )

    class Meta:
        verbose_name = _("notification preference")
        verbose_name_plural = _("notification preferences")

    def __str__(self):
        return f"Preferences for {self.user}"

    def is_channel_allowed(self, channel: str, notification_type: str | None = None) -> bool:
        channel = (channel or Notification.Channel.IN_APP).upper()
        if channel == Notification.Channel.EMAIL and not self.email_enabled:
            return False
        if channel == Notification.Channel.SMS and not self.sms_enabled:
            return False
        if channel == Notification.Channel.IN_APP and not self.in_app_enabled:
            return False
        if channel == Notification.Channel.BROWSER and not self.browser_enabled:
            return False
        if channel == Notification.Channel.PUSH and not self.browser_enabled:
            return False

        if notification_type and isinstance(self.preferences, dict):
            type_prefs = self.preferences.get(notification_type) or self.preferences.get(
                notification_type.lower()
            )
            if isinstance(type_prefs, dict):
                key = channel.lower()
                if key in type_prefs:
                    return bool(type_prefs[key])
                if channel == Notification.Channel.IN_APP and "in_app" in type_prefs:
                    return bool(type_prefs["in_app"])
                if channel == Notification.Channel.BROWSER and "browser" in type_prefs:
                    return bool(type_prefs["browser"])
        return True


class NotificationTemplate(UUIDPrimaryKeyModel, TimeStampedModel, SoftDeleteModel):
    """Reusable title/body templates keyed by event_code + channel."""

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    code = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=255)
    channel = models.CharField(
        max_length=20,
        choices=Notification.Channel.choices,
        default=Notification.Channel.IN_APP,
    )
    notification_type = models.CharField(
        max_length=30,
        choices=Notification.NotificationType.choices,
        default=Notification.NotificationType.SYSTEM,
    )
    subject = models.CharField(max_length=255, blank=True, default="")
    title_template = models.CharField(max_length=255)
    body_template = models.TextField()
    default_priority = models.CharField(
        max_length=10,
        choices=Notification.Priority.choices,
        default=Notification.Priority.MEDIUM,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["code", "channel"]
        verbose_name = _("notification template")
        verbose_name_plural = _("notification templates")
        constraints = [
            models.UniqueConstraint(
                fields=["code", "channel"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_template_code_channel",
            )
        ]

    def __str__(self):
        return f"{self.code} [{self.channel}]"

    def render(self, context: dict | None = None) -> dict[str, str]:
        ctx = context or {}
        try:
            title = self.title_template.format(**ctx)
            body = self.body_template.format(**ctx)
            subject = (self.subject or self.title_template).format(**ctx)
        except (KeyError, ValueError):
            title = self.title_template
            body = self.body_template
            subject = self.subject or self.title_template
        return {"title": title, "message": body, "subject": subject}


class NotificationDelivery(UUIDPrimaryKeyModel, TimeStampedModel):
    """Per-channel delivery attempt for a notification."""

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        QUEUED = "QUEUED", _("Queued")
        SENT = "SENT", _("Sent")
        DELIVERED = "DELIVERED", _("Delivered")
        FAILED = "FAILED", _("Failed")
        SKIPPED = "SKIPPED", _("Skipped")

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="deliveries",
    )
    channel = models.CharField(max_length=20, choices=Notification.Channel.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    provider = models.CharField(max_length=64, blank=True, default="")
    provider_message_id = models.CharField(max_length=255, blank=True, default="")
    attempt_count = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("notification delivery")
        verbose_name_plural = _("notification deliveries")
        indexes = [
            models.Index(fields=["channel", "status", "-created_at"]),
            models.Index(fields=["notification", "channel"]),
        ]

    def __str__(self):
        return f"{self.channel}:{self.status} for notification {self.notification_id}"


class NotificationLog(UUIDPrimaryKeyModel, TimeStampedModel):
    """Immutable audit trail for notification lifecycle events."""

    class Action(models.TextChoices):
        CREATED = "CREATED", _("Created")
        QUEUED = "QUEUED", _("Queued")
        SENT = "SENT", _("Sent")
        DELIVERED = "DELIVERED", _("Delivered")
        READ = "READ", _("Read")
        ARCHIVED = "ARCHIVED", _("Archived")
        DELETED = "DELETED", _("Deleted")
        FAILED = "FAILED", _("Failed")
        RETRIED = "RETRIED", _("Retried")
        PREFERENCE_SKIPPED = "PREFERENCE_SKIPPED", _("Skipped by preference")

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="logs",
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_logs",
    )
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    detail = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("notification log")
        verbose_name_plural = _("notification logs")
        indexes = [
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.action} @ {self.created_at}"


# Backward-compatible aliases for docs / imports that expect these names
NotificationRecipient = Notification  # one row per recipient already
NotificationHistory = NotificationLog

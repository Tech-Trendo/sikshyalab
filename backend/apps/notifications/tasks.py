"""Celery tasks for async notification delivery, digests, and retries."""

from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils import timezone

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
    name="notifications.deliver_email",
)
def deliver_email_notification(self, notification_id: int) -> bool:
    from apps.notifications.models import Notification
    from apps.notifications.services.email import EmailNotificationService

    try:
        notification = Notification.objects.select_related("recipient").get(
            pk=notification_id
        )
    except Notification.DoesNotExist:
        logger.warning("Notification %s missing for email delivery", notification_id)
        return False

    notification.status = Notification.Status.QUEUED
    notification.save(update_fields=["status", "updated_at"])
    return EmailNotificationService.deliver(notification)


@shared_task(name="notifications.retry_failed_deliveries")
def retry_failed_deliveries(max_age_hours: int = 24, limit: int = 100) -> int:
    from apps.notifications.models import NotificationDelivery
    from apps.notifications.tasks import deliver_email_notification

    since = timezone.now() - timedelta(hours=max_age_hours)
    qs = (
        NotificationDelivery.objects.filter(
            status=NotificationDelivery.Status.FAILED,
            channel="EMAIL",
            created_at__gte=since,
            attempt_count__lt=5,
        )
        .select_related("notification")
        .order_by("created_at")[:limit]
    )
    count = 0
    for delivery in qs:
        deliver_email_notification.delay(delivery.notification_id)
        count += 1
    return count


@shared_task(name="notifications.send_daily_digest")
def send_daily_digest() -> int:
    from apps.notifications.models import Notification, NotificationPreference
    from apps.notifications.services.email import EmailNotificationService
    from apps.notifications.services.notification import NotificationService

    prefs = NotificationPreference.objects.filter(
        digest_daily=True, email_enabled=True
    ).select_related("user")
    sent = 0
    since = timezone.now() - timedelta(hours=24)
    for pref in prefs.iterator():
        user = pref.user
        unread = (
            Notification.objects.filter(
                recipient=user, is_read=False, is_archived=False, created_at__gte=since
            )
            .order_by("-created_at")[:20]
        )
        items = list(unread)
        if not items:
            continue
        lines = [f"- {n.title}" for n in items]
        body = (
            f"You have {len(items)} unread notification(s) in the last 24 hours:\n\n"
            + "\n".join(lines)
            + "\n\nOpen your dashboard to review them."
        )
        digest = NotificationService.create(
            user,
            title="Daily notification digest",
            message=body,
            notification_type=Notification.NotificationType.SYSTEM,
            event_code="DAILY_DIGEST",
            channel=Notification.Channel.EMAIL,
            priority=Notification.Priority.LOW,
            force=True,
            push_realtime=False,
            send_email=False,
        )
        if digest:
            EmailNotificationService.deliver(digest)
            sent += 1
    return sent


@shared_task(name="notifications.send_weekly_summary")
def send_weekly_summary() -> int:
    from apps.notifications.models import Notification, NotificationPreference
    from apps.notifications.services.email import EmailNotificationService
    from apps.notifications.services.notification import NotificationService

    prefs = NotificationPreference.objects.filter(
        digest_weekly=True, email_enabled=True
    ).select_related("user")
    sent = 0
    since = timezone.now() - timedelta(days=7)
    for pref in prefs.iterator():
        user = pref.user
        from django.db.models import Q

        stats = Notification.objects.filter(recipient=user, created_at__gte=since).aggregate(
            total=Count("id"),
            unread=Count("id", filter=Q(is_read=False)),
        )
        total = stats["total"] or 0
        if total == 0:
            continue
        body = (
            f"Weekly summary: {total} notification(s), "
            f"{stats['unread'] or 0} still unread. "
            "Visit ShikshaLab to catch up."
        )
        summary = NotificationService.create(
            user,
            title="Weekly notification summary",
            message=body,
            notification_type=Notification.NotificationType.SYSTEM,
            event_code="WEEKLY_SUMMARY",
            channel=Notification.Channel.EMAIL,
            priority=Notification.Priority.LOW,
            force=True,
            push_realtime=False,
            send_email=False,
        )
        if summary:
            EmailNotificationService.deliver(summary)
            sent += 1
    return sent


@shared_task(name="notifications.assignment_deadline_reminders")
def assignment_deadline_reminders() -> int:
    """Send reminders for assignments due within 24 hours."""
    try:
        from apps.assignments.models import Assignment
    except Exception:
        return 0

    from apps.notifications.services.domain import _resolve_assignment_recipients
    from apps.notifications.services.notification import NotificationService
    from apps.notifications.models import Notification

    now = timezone.now()
    window_end = now + timedelta(hours=24)
    qs = Assignment.objects.filter(
        status="PUBLISHED",
        due_date__gte=now,
        due_date__lte=window_end,
    )
    sent = 0
    for assignment in qs.iterator():
        users = _resolve_assignment_recipients(assignment)
        created = NotificationService.notify_many(
            users,
            title=f"Assignment due soon: {getattr(assignment, 'title', 'Assignment')}",
            message="This assignment is due within 24 hours.",
            notification_type=Notification.NotificationType.ASSIGNMENT,
            event_code="ASSIGNMENT_REMINDER",
            priority=Notification.Priority.HIGH,
            action_url=f"/assignments/{assignment.pk}",
            related_object_type="assignment",
            related_object_id=assignment.pk,
            channels=[Notification.Channel.EMAIL, Notification.Channel.BROWSER],
        )
        sent += len(created)
    return sent

"""Admin-facing notification analytics."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.notifications.models import Notification, NotificationDelivery


class NotificationAnalyticsService:
    @staticmethod
    def overview(days: int = 30) -> dict:
        since = timezone.now() - timedelta(days=max(1, days))
        qs = Notification.objects.filter(created_at__gte=since)
        total = qs.count()
        read = qs.filter(is_read=True).count()
        unread = qs.filter(is_read=False, is_archived=False).count()
        failed = qs.filter(status=Notification.Status.FAILED).count()
        archived = qs.filter(is_archived=True).count()

        by_category = list(
            qs.values("notification_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        by_priority = list(
            qs.values("priority").annotate(count=Count("id")).order_by("-count")
        )
        by_status = list(
            qs.values("status").annotate(count=Count("id")).order_by("-count")
        )
        by_event = list(
            qs.exclude(event_code="")
            .values("event_code")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )
        by_role = list(
            qs.values("recipient__role")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        daily = list(
            qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        most_active = list(
            qs.values("recipient_id", "recipient__email")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )
        delivery_failed = NotificationDelivery.objects.filter(
            created_at__gte=since,
            status=NotificationDelivery.Status.FAILED,
        ).count()

        read_rate = round((read / total) * 100, 2) if total else 0.0
        return {
            "period_days": days,
            "total_notifications": total,
            "read_count": read,
            "unread_count": unread,
            "archived_count": archived,
            "failed_count": failed,
            "failed_deliveries": delivery_failed,
            "read_rate": read_rate,
            "by_category": by_category,
            "by_priority": by_priority,
            "by_status": by_status,
            "by_event": by_event,
            "by_role": [
                {"role": row["recipient__role"], "count": row["count"]} for row in by_role
            ],
            "daily": [
                {"date": row["day"].isoformat() if row["day"] else None, "count": row["count"]}
                for row in daily
            ],
            "most_active_users": [
                {
                    "user_id": row["recipient_id"],
                    "email": row["recipient__email"],
                    "count": row["count"],
                }
                for row in most_active
            ],
        }

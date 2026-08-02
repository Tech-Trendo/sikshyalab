"""Notification service critical path."""

import pytest

from apps.notifications.models import Notification
from apps.notifications.services import (
    ensure_inbox_seeded,
    mark_all_read,
    mark_notification_read,
    notify_enrollment_approved,
    notify_user,
)


@pytest.mark.django_db
class TestNotificationServices:
    def test_notify_user_creates_in_app(self, student_user):
        n = notify_user(
            student_user,
            title="Hello",
            message="World",
            notification_type=Notification.NotificationType.SYSTEM,
            force=True,
        )
        assert n is not None
        assert n.recipient_id == student_user.pk
        assert n.is_read is False
        assert n.channel == Notification.Channel.IN_APP

    def test_notify_user_none_user(self):
        assert notify_user(None, "t", "m", force=True) is None

    def test_mark_all_read(self, student_user):
        notify_user(student_user, "A", "a", force=True)
        notify_user(student_user, "B", "b", force=True)
        count = mark_all_read(student_user)
        assert count >= 2
        assert (
            Notification.objects.filter(recipient=student_user, is_read=False).count()
            == 0
        )

    def test_mark_notification_read_permission(self, student_user, admin_user):
        n = notify_user(student_user, "Private", "x", force=True)
        with pytest.raises(PermissionError):
            mark_notification_read(n, user=admin_user)
        marked = mark_notification_read(n, user=student_user)
        assert marked.is_read is True

    def test_ensure_inbox_seeded_student_once(self, student_user):
        Notification.objects.filter(recipient=student_user).delete()
        first = ensure_inbox_seeded(student_user)
        assert len(first) >= 1
        second = ensure_inbox_seeded(student_user)
        assert second == []

    def test_notify_enrollment_approved(self, pending_enrollment, student_user):
        Notification.objects.filter(recipient=student_user).delete()
        n = notify_enrollment_approved(pending_enrollment)
        assert n is not None
        assert n.notification_type == Notification.NotificationType.ENROLLMENT
        assert n.recipient_id == student_user.pk
        assert "approved" in n.message.lower()

"""API + analytics coverage for enterprise notification module."""

import pytest
from rest_framework.test import APIClient

from apps.notifications.models import Notification, NotificationTemplate
from apps.notifications.services import NotificationService, notify_user
from apps.notifications.services.analytics import NotificationAnalyticsService
from apps.notifications.services.templates import NotificationTemplateService


@pytest.mark.django_db
class TestEnterpriseNotificationServices:
    def test_critical_creates_with_status(self, student_user):
        n = NotificationService.create(
            student_user,
            title="Locked",
            message="Account locked",
            notification_type=Notification.NotificationType.SECURITY,
            event_code="ACCOUNT_LOCKED",
            priority=Notification.Priority.CRITICAL,
            force=True,
        )
        assert n is not None
        assert n.priority == Notification.Priority.CRITICAL
        assert n.uuid
        assert n.status in (
            Notification.Status.DELIVERED,
            Notification.Status.SENT,
            Notification.Status.PENDING,
        )

    def test_archive_and_soft_delete(self, student_user):
        n = notify_user(student_user, "A", "B", force=True)
        NotificationService.archive(n, user=student_user)
        n.refresh_from_db()
        assert n.is_archived is True
        assert n.status == Notification.Status.ARCHIVED

        NotificationService.soft_delete(n, user=student_user)
        assert Notification.objects.filter(pk=n.pk).count() == 0
        assert Notification.all_objects.filter(pk=n.pk, is_deleted=True).exists()

    def test_template_render(self):
        NotificationTemplateService.upsert(
            code="WELCOME",
            name="Welcome",
            channel="IN_APP",
            title_template="Hello {name}",
            body_template="Welcome {name}",
            notification_type="AUTH",
        )
        rendered = NotificationTemplateService.render("WELCOME", "IN_APP", {"name": "Ada"})
        assert rendered["title"] == "Hello Ada"

    def test_analytics_overview(self, student_user, admin_user):
        notify_user(student_user, "One", "msg", force=True)
        notify_user(admin_user, "Two", "msg", force=True)
        data = NotificationAnalyticsService.overview(days=7)
        assert data["total_notifications"] >= 2
        assert "read_rate" in data
        assert "by_category" in data


@pytest.mark.django_db
class TestNotificationAPI:
    def test_list_and_mark_read(self, student_user):
        n = notify_user(student_user, "Hi", "There", force=True)
        client = APIClient()
        client.force_authenticate(user=student_user)
        res = client.get("/api/v1/notifications/")
        assert res.status_code == 200
        res2 = client.post(f"/api/v1/notifications/{n.pk}/mark_read/")
        assert res2.status_code == 200
        n.refresh_from_db()
        assert n.is_read is True

    def test_archive_endpoint(self, student_user):
        n = notify_user(student_user, "Arch", "me", force=True)
        client = APIClient()
        client.force_authenticate(user=student_user)
        res = client.post(f"/api/v1/notifications/{n.pk}/archive/")
        assert res.status_code == 200
        n.refresh_from_db()
        assert n.is_archived is True

    def test_preferences_me(self, student_user):
        client = APIClient()
        client.force_authenticate(user=student_user)
        res = client.get("/api/v1/notifications/preferences/me/")
        assert res.status_code == 200
        res2 = client.patch(
            "/api/v1/notifications/preferences/me/",
            {"browser_enabled": False},
            format="json",
        )
        assert res2.status_code == 200

    def test_analytics_admin_only(self, student_user, admin_user):
        client = APIClient()
        client.force_authenticate(user=student_user)
        assert client.get("/api/v1/notifications/analytics/").status_code == 403
        client.force_authenticate(user=admin_user)
        res = client.get("/api/v1/notifications/analytics/")
        assert res.status_code == 200

    def test_broadcast_admin(self, admin_user, student_user):
        client = APIClient()
        client.force_authenticate(user=admin_user)
        res = client.post(
            "/api/v1/notifications/broadcast/",
            {
                "title": "Maintenance",
                "message": "Tonight 2am",
                "role": "STUDENT",
                "priority": "HIGH",
                "force": True,
            },
            format="json",
        )
        assert res.status_code in (200, 201)
        assert Notification.objects.filter(
            recipient=student_user, title="Maintenance"
        ).exists()

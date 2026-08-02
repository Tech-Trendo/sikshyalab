"""Seed default notification templates for common event codes."""

from django.core.management.base import BaseCommand

from apps.notifications.constants import EVENTS
from apps.notifications.models import Notification
from apps.notifications.services.templates import NotificationTemplateService

DEFAULTS = [
    ("WELCOME", "Welcome", "Welcome to ShikshaLab", "Hi {name}, your account is ready."),
    ("PASSWORD_CHANGED", "Password changed", "Password changed", "Your password was changed. If this wasn't you, contact support."),
    ("ASSIGNMENT_CREATED", "Assignment created", "New assignment: {title}", "Due: {due_date}"),
    ("ASSIGNMENT_REMINDER", "Assignment reminder", "Reminder: {title}", "This assignment is due soon."),
    ("ENROLLMENT_APPROVED", "Enrollment approved", "Enrollment approved", "Your enrollment for {course} is approved."),
    ("CERTIFICATE_ISSUED", "Certificate issued", "Certificate ready", "Certificate {code} is ready to download."),
    ("PAYMENT_RECEIVED", "Payment received", "Payment received", "We received {amount} (ref: {ref})."),
]


class Command(BaseCommand):
    help = "Seed default NotificationTemplate rows for core event codes."

    def handle(self, *args, **options):
        created = 0
        for code, name, title, body in DEFAULTS:
            ntype = EVENTS.get(code, Notification.NotificationType.SYSTEM)
            for channel in (Notification.Channel.IN_APP, Notification.Channel.EMAIL):
                NotificationTemplateService.upsert(
                    code=code,
                    name=name,
                    channel=channel,
                    title_template=title,
                    body_template=body,
                    subject=title,
                    notification_type=ntype,
                    default_priority=(
                        Notification.Priority.CRITICAL
                        if code == "PASSWORD_CHANGED"
                        else Notification.Priority.MEDIUM
                    ),
                )
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Upserted {created} templates."))

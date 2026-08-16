"""Celery application for ShikshaLab."""

import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("shikshalab")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "notifications-retry-failed-hourly": {
        "task": "notifications.retry_failed_deliveries",
        "schedule": crontab(minute=15),
    },
    "notifications-daily-digest": {
        "task": "notifications.send_daily_digest",
        "schedule": crontab(hour=7, minute=0),
    },
    "notifications-weekly-summary": {
        "task": "notifications.send_weekly_summary",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),
    },
    "notifications-assignment-reminders": {
        "task": "notifications.assignment_deadline_reminders",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    "fees-mark-overdue-daily": {
        "task": "fees.mark_overdue_fees",
        "schedule": crontab(hour=1, minute=0),
    },
    "fees-send-reminders-daily": {
        "task": "fees.send_fee_reminders",
        "schedule": crontab(hour=8, minute=30),
    },
    # Runs daily; PartnerSynchronizer itself enforces the 30-day gate.
    "cms-sync-partners-daily": {
        "task": "cms.sync_partners",
        "schedule": crontab(hour=3, minute=15),
    },
    "videos-cleanup-stuck-processing": {
        "task": "apps.videos.tasks.cleanup_stuck_processing",
        "schedule": crontab(hour="*/2", minute=0),
    },
    "content-cleanup-stuck-resource-processing": {
        "task": "content.cleanup_stuck_resource_processing",
        "schedule": crontab(hour="*/2", minute=20),
    },
}


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")

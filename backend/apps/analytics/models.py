"""
Optional saved analytics reports.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedModel


class SavedReport(TimeStampedModel):
    """Named analytics report configuration saved by an admin/teacher."""

    class ReportType(models.TextChoices):
        DASHBOARD = "DASHBOARD", _("Dashboard")
        ENROLLMENT_TRENDS = "ENROLLMENT_TRENDS", _("Enrollment Trends")
        STUDENT_GROWTH = "STUDENT_GROWTH", _("Student Growth")
        REVENUE_SUMMARY = "REVENUE_SUMMARY", _("Revenue Summary")
        ATTENDANCE = "ATTENDANCE", _("Attendance")
        ASSIGNMENT_COMPLETION = "ASSIGNMENT_COMPLETION", _("Assignment Completion")
        CERTIFICATES = "CERTIFICATES", _("Certificates")
        TEACHER_PERFORMANCE = "TEACHER_PERFORMANCE", _("Teacher Performance")
        CUSTOM = "CUSTOM", _("Custom")

    name = models.CharField(max_length=200)
    report_type = models.CharField(
        max_length=40,
        choices=ReportType.choices,
        default=ReportType.CUSTOM,
        db_index=True,
    )
    params = models.JSONField(
        default=dict,
        blank=True,
        help_text=_("Query parameters / filters used to generate this report."),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="saved_analytics_reports",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("saved report")
        verbose_name_plural = _("saved reports")
        indexes = [
            models.Index(fields=["report_type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.report_type})"

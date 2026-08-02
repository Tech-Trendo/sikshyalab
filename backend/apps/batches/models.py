"""
Batch / cohort models for ShikshaLab.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel, TimeStampedModel


class Shift(TimeStampedModel):
    """Named time-of-day shift (morning / evening / etc.)."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    working_days = models.JSONField(
        default=list,
        blank=True,
        help_text=_("List of weekday names or indices."),
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["start_time", "name"]
        verbose_name = _("shift")
        verbose_name_plural = _("shifts")

    def __str__(self):
        return f"{self.code} — {self.name}"

    def clean(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValidationError({"end_time": _("End time must be after start time.")})


class Batch(BaseModel):
    """A cohort / batch of students for a course."""

    class Status(models.TextChoices):
        UPCOMING = "UPCOMING", _("Upcoming")
        ONGOING = "ONGOING", _("Ongoing")
        COMPLETED = "COMPLETED", _("Completed")
        CANCELLED = "CANCELLED", _("Cancelled")

    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="batches",
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="batches",
    )
    teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="batches",
    )
    capacity = models.PositiveIntegerField(default=30)
    enrolled_count = models.PositiveIntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    class_start_time = models.TimeField(null=True, blank=True)
    class_end_time = models.TimeField(null=True, blank=True)
    working_days = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPCOMING,
        db_index=True,
    )
    room_number = models.CharField(max_length=50, blank=True)
    meeting_link = models.URLField(blank=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_batches",
    )

    class Meta:
        ordering = ["-start_date", "name"]
        verbose_name = _("batch")
        verbose_name_plural = _("batches")
        indexes = [
            models.Index(fields=["status", "code"]),
            models.Index(fields=["start_date"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"

    @property
    def seats_available(self):
        return max(0, (self.capacity or 0) - (self.enrolled_count or 0))

    @property
    def is_full(self):
        return self.seats_available <= 0


class BatchStudent(BaseModel):
    """Membership of a student in a batch."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", _("Active")
        DROPPED = "DROPPED", _("Dropped")
        COMPLETED = "COMPLETED", _("Completed")
        SUSPENDED = "SUSPENDED", _("Suspended")

    batch = models.ForeignKey(
        Batch,
        on_delete=models.CASCADE,
        related_name="batch_students",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="batch_memberships",
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-enrolled_at"]
        verbose_name = _("batch student")
        verbose_name_plural = _("batch students")
        constraints = [
            models.UniqueConstraint(
                fields=["batch", "student"],
                name="unique_batch_student",
            )
        ]

    def __str__(self):
        return f"{self.student} ∈ {self.batch.code}"


class BatchSchedule(BaseModel):
    """Per-session schedule entry for a batch."""

    class DayOfWeek(models.IntegerChoices):
        MONDAY = 0, _("Monday")
        TUESDAY = 1, _("Tuesday")
        WEDNESDAY = 2, _("Wednesday")
        THURSDAY = 3, _("Thursday")
        FRIDAY = 4, _("Friday")
        SATURDAY = 5, _("Saturday")
        SUNDAY = 6, _("Sunday")

    batch = models.ForeignKey(
        Batch,
        on_delete=models.CASCADE,
        related_name="schedules",
    )
    day_of_week = models.PositiveSmallIntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    topic = models.CharField(max_length=255, blank=True)
    is_cancelled = models.BooleanField(default=False)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        verbose_name = _("batch schedule")
        verbose_name_plural = _("batch schedules")

    def __str__(self):
        return (
            f"{self.batch.code} — {self.get_day_of_week_display()} "
            f"{self.start_time}-{self.end_time}"
        )

    def clean(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValidationError({"end_time": _("End time must be after start time.")})

"""
Student/teacher attendance, sessions, and monthly summaries.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class StudentAttendance(BaseModel):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", _("Present")
        ABSENT = "ABSENT", _("Absent")
        LATE = "LATE", _("Late")
        EXCUSED = "EXCUSED", _("Excused")
        HALF_DAY = "HALF_DAY", _("Half Day")

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    batch = models.ForeignKey(
        "batches.Batch",
        on_delete=models.CASCADE,
        related_name="student_attendance",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_attendance",
    )
    date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PRESENT,
        db_index=True,
    )
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_student_attendance",
    )
    remarks = models.TextField(blank=True)
    session_start = models.TimeField(null=True, blank=True)
    session_end = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = _("student attendance")
        verbose_name_plural = _("student attendance")
        constraints = [
            models.UniqueConstraint(
                fields=["student", "batch", "date"],
                name="unique_student_batch_date_attendance",
            ),
        ]
        indexes = [
            models.Index(fields=["batch", "date"]),
            models.Index(fields=["student", "date"]),
            models.Index(fields=["status", "date"]),
        ]

    def __str__(self):
        return f"{self.student} — {self.date} ({self.status})"


class TeacherAttendance(BaseModel):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", _("Present")
        ABSENT = "ABSENT", _("Absent")
        LATE = "LATE", _("Late")
        ON_LEAVE = "ON_LEAVE", _("On Leave")
        HALF_DAY = "HALF_DAY", _("Half Day")

    teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PRESENT,
        db_index=True,
    )
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_teacher_attendance",
    )
    remarks = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = _("teacher attendance")
        verbose_name_plural = _("teacher attendance")
        constraints = [
            models.UniqueConstraint(
                fields=["teacher", "date"],
                name="unique_teacher_date_attendance",
            ),
        ]
        indexes = [
            models.Index(fields=["teacher", "date"]),
            models.Index(fields=["status", "date"]),
        ]

    def __str__(self):
        return f"{self.teacher} — {self.date} ({self.status})"


class AttendanceSession(BaseModel):
    batch = models.ForeignKey(
        "batches.Batch",
        on_delete=models.CASCADE,
        related_name="attendance_sessions",
    )
    date = models.DateField(db_index=True)
    topic = models.CharField(max_length=255, blank=True)
    taken_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_sessions_taken",
    )
    taken_by_teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_sessions",
    )
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = _("attendance session")
        verbose_name_plural = _("attendance sessions")
        indexes = [
            models.Index(fields=["batch", "date"]),
        ]

    def __str__(self):
        return f"Session {self.batch} — {self.date}"


class MonthlyAttendanceSummary(BaseModel):
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="monthly_attendance_summaries",
    )
    teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="monthly_attendance_summaries",
    )
    month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )
    year = models.PositiveIntegerField()
    total_days = models.PositiveIntegerField(default=0)
    present_days = models.PositiveIntegerField(default=0)
    absent_days = models.PositiveIntegerField(default=0)
    late_days = models.PositiveIntegerField(default=0)
    attendance_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month"]
        verbose_name = _("monthly attendance summary")
        verbose_name_plural = _("monthly attendance summaries")
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(student__isnull=False, teacher__isnull=True)
                    | models.Q(student__isnull=True, teacher__isnull=False)
                ),
                name="summary_requires_student_xor_teacher",
            ),
            models.UniqueConstraint(
                fields=["student", "month", "year"],
                condition=models.Q(student__isnull=False),
                name="unique_student_month_year_summary",
            ),
            models.UniqueConstraint(
                fields=["teacher", "month", "year"],
                condition=models.Q(teacher__isnull=False),
                name="unique_teacher_month_year_summary",
            ),
        ]
        indexes = [
            models.Index(fields=["year", "month"]),
        ]

    def __str__(self):
        subject = self.student or self.teacher
        return f"{subject} — {self.month}/{self.year} ({self.attendance_percentage}%)"

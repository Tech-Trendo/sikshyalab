"""
Teacher domain models for ShikshaLab.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class Teacher(BaseModel):
    """One-to-one teacher profile linked to an accounts.User."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", _("Active")
        INACTIVE = "INACTIVE", _("Inactive")
        ON_LEAVE = "ON_LEAVE", _("On Leave")

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teacher_profile",
    )
    teacher_id = models.CharField(max_length=50, unique=True, db_index=True)
    employee_id = models.CharField(max_length=50, blank=True, db_index=True)
    designation = models.CharField(max_length=150, blank=True)
    department = models.CharField(max_length=150, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    bio = models.TextField(blank=True)
    specialization = models.JSONField(
        default=list,
        blank=True,
        help_text=_("List of specialization areas."),
    )
    years_of_experience = models.PositiveIntegerField(default=0)
    linkedin_url = models.URLField(blank=True)
    website = models.URLField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("teacher")
        verbose_name_plural = _("teachers")
        indexes = [
            models.Index(fields=["status", "teacher_id"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.teacher_id} — {self.user}"


class TeacherQualification(BaseModel):
    """Academic qualification for a teacher."""

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="qualifications",
    )
    degree = models.CharField(max_length=150)
    institution = models.CharField(max_length=255)
    year = models.PositiveIntegerField(null=True, blank=True)
    field = models.CharField(max_length=150, blank=True)
    certificate_file = models.FileField(
        upload_to="teachers/qualifications/",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-year", "degree"]
        verbose_name = _("teacher qualification")
        verbose_name_plural = _("teacher qualifications")

    def __str__(self):
        return f"{self.degree} — {self.teacher.teacher_id}"


class TeacherExperience(BaseModel):
    """Work experience entry for a teacher."""

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="experiences",
    )
    organization = models.CharField(max_length=255)
    position = models.CharField(max_length=150)
    from_date = models.DateField()
    to_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_current", "-from_date"]
        verbose_name = _("teacher experience")
        verbose_name_plural = _("teacher experiences")

    def __str__(self):
        return f"{self.position} @ {self.organization}"

    def clean(self):
        if self.to_date and self.from_date and self.to_date < self.from_date:
            raise ValidationError({"to_date": _("End date cannot be before start date.")})
        if self.is_current and self.to_date:
            raise ValidationError(
                {"to_date": _("Current roles should not have an end date.")}
            )


class TeacherDocument(BaseModel):
    """Uploaded document belonging to a teacher."""

    class DocType(models.TextChoices):
        CV = "CV", _("CV / Resume")
        CERTIFICATE = "CERTIFICATE", _("Certificate")
        CONTRACT = "CONTRACT", _("Contract")
        ID_PROOF = "ID_PROOF", _("ID Proof")
        OTHER = "OTHER", _("Other")

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    doc_type = models.CharField(
        max_length=30,
        choices=DocType.choices,
        default=DocType.OTHER,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="teachers/documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = _("teacher document")
        verbose_name_plural = _("teacher documents")

    def __str__(self):
        return f"{self.title} — {self.teacher.teacher_id}"


class TeacherSchedule(BaseModel):
    """Weekly availability / teaching slot for a teacher."""

    class DayOfWeek(models.IntegerChoices):
        MONDAY = 0, _("Monday")
        TUESDAY = 1, _("Tuesday")
        WEDNESDAY = 2, _("Wednesday")
        THURSDAY = 3, _("Thursday")
        FRIDAY = 4, _("Friday")
        SATURDAY = 5, _("Saturday")
        SUNDAY = 6, _("Sunday")

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="schedules",
    )
    day_of_week = models.PositiveSmallIntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teacher_schedules",
    )
    batch = models.ForeignKey(
        "batches.Batch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teacher_schedules",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        verbose_name = _("teacher schedule")
        verbose_name_plural = _("teacher schedules")

    def __str__(self):
        return (
            f"{self.teacher.teacher_id} — "
            f"{self.get_day_of_week_display()} {self.start_time}-{self.end_time}"
        )

    def clean(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValidationError({"end_time": _("End time must be after start time.")})


class TeacherWorkload(BaseModel):
    """Monthly workload tracking for a teacher."""

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="workloads",
    )
    month = models.PositiveSmallIntegerField()
    year = models.PositiveIntegerField()
    hours_assigned = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    hours_completed = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-year", "-month"]
        verbose_name = _("teacher workload")
        verbose_name_plural = _("teacher workloads")
        constraints = [
            models.UniqueConstraint(
                fields=["teacher", "month", "year"],
                name="unique_teacher_workload_month_year",
            ),
            models.CheckConstraint(
                condition=models.Q(month__gte=1) & models.Q(month__lte=12),
                name="teacher_workload_month_range",
            ),
        ]

    def __str__(self):
        return f"{self.teacher.teacher_id} — {self.year}-{self.month:02d}"

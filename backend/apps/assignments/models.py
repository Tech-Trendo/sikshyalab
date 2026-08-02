"""
Assignments, allocations, submissions, and reviews.
"""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class Assignment(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Draft")
        PUBLISHED = "PUBLISHED", _("Published")
        CLOSED = "CLOSED", _("Closed")

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    batch = models.ForeignKey(
        "batches.Batch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignments",
    )
    teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    instructions = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to="assignments/attachments/",
        null=True,
        blank=True,
    )
    due_date = models.DateTimeField()
    max_marks = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    grading_criteria = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    allow_late_submission = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("assignment")
        verbose_name_plural = _("assignments")
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return self.title


class AssignmentResource(BaseModel):
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="resources",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(
        upload_to="assignments/resources/",
        null=True,
        blank=True,
    )
    link = models.URLField(blank=True)

    class Meta:
        ordering = ["title"]
        verbose_name = _("assignment resource")
        verbose_name_plural = _("assignment resources")

    def __str__(self):
        return f"{self.assignment.title} — {self.title}"


class AssignmentAllocation(BaseModel):
    """Allocate an assignment to an individual student and/or an entire batch."""

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="allocations",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="assignment_allocations",
    )
    batch = models.ForeignKey(
        "batches.Batch",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="assignment_allocations",
    )
    allocated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-allocated_at"]
        verbose_name = _("assignment allocation")
        verbose_name_plural = _("assignment allocations")
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(student__isnull=False)
                    | models.Q(batch__isnull=False)
                ),
                name="allocation_requires_student_or_batch",
            ),
        ]
        indexes = [
            models.Index(fields=["assignment", "student"]),
            models.Index(fields=["assignment", "batch"]),
        ]

    def __str__(self):
        target = self.student or self.batch
        return f"{self.assignment.title} → {target}"


class Submission(BaseModel):
    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", _("Submitted")
        LATE = "LATE", _("Late")
        RESUBMITTED = "RESUBMITTED", _("Resubmitted")
        GRADED = "GRADED", _("Graded")
        RETURNED = "RETURNED", _("Returned")

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    content = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to="assignments/submissions/",
        null=True,
        blank=True,
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
        db_index=True,
    )
    attempt_number = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-submitted_at"]
        verbose_name = _("submission")
        verbose_name_plural = _("submissions")
        indexes = [
            models.Index(fields=["assignment", "student"]),
            models.Index(fields=["status", "submitted_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student", "attempt_number"],
                name="unique_submission_attempt",
            ),
        ]

    def __str__(self):
        return f"{self.assignment.title} — {self.student} (#{self.attempt_number})"


class SubmissionReview(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Draft")
        PUBLISHED = "PUBLISHED", _("Published")
        RETURNED = "RETURNED", _("Returned")

    submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name="review",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submission_reviews",
    )
    reviewer_teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submission_reviews",
    )
    marks_obtained = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PUBLISHED,
        db_index=True,
    )

    class Meta:
        ordering = ["-graded_at"]
        verbose_name = _("submission review")
        verbose_name_plural = _("submission reviews")

    def __str__(self):
        return f"Review of {self.submission}"

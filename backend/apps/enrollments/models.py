"""
Enrollment workflow models for ShikshaLab.
"""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedModel


class Enrollment(TimeStampedModel):
    """Student enrollment into a course (optionally a batch/shift)."""

    class EnrollmentType(models.TextChoices):
        PHYSICAL = "PHYSICAL", _("Physical")
        ONLINE = "ONLINE", _("Online")
        HYBRID = "HYBRID", _("Hybrid")

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        APPROVED = "APPROVED", _("Approved")
        REJECTED = "REJECTED", _("Rejected")
        ACTIVE = "ACTIVE", _("Active")
        COMPLETED = "COMPLETED", _("Completed")
        CANCELLED = "CANCELLED", _("Cancelled")
        SUSPENDED = "SUSPENDED", _("Suspended")

    class PaymentStatus(models.TextChoices):
        UNPAID = "UNPAID", _("Unpaid")
        PARTIAL = "PARTIAL", _("Partial")
        PAID = "PAID", _("Paid")
        REFUNDED = "REFUNDED", _("Refunded")

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    batch = models.ForeignKey(
        "batches.Batch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrollments",
    )
    shift = models.ForeignKey(
        "batches.Shift",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrollments",
    )
    enrollment_type = models.CharField(
        max_length=20,
        choices=EnrollmentType.choices,
        default=EnrollmentType.PHYSICAL,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    final_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_enrollments",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    enrolled_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    enrollment_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("enrollment")
        verbose_name_plural = _("enrollments")
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course", "status"]),
            models.Index(fields=["batch", "status"]),
            models.Index(fields=["payment_status"]),
            models.Index(fields=["enrollment_number"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "course"],
                condition=models.Q(
                    status__in=["PENDING", "APPROVED", "ACTIVE", "SUSPENDED"]
                ),
                name="unique_active_enrollment_per_student_course",
            ),
        ]

    def __str__(self):
        return f"{self.enrollment_number} — {self.student_id} / {self.course_id}"

    def compute_final_amount(self) -> Decimal:
        amount = self.amount or Decimal("0.00")
        discount = self.discount_amount or Decimal("0.00")
        return max(Decimal("0.00"), amount - discount)

    def save(self, *args, **kwargs):
        self.final_amount = self.compute_final_amount()
        super().save(*args, **kwargs)


class EnrollmentHistory(TimeStampedModel):
    """Audit trail of enrollment status transitions."""

    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name="history",
    )
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrollment_status_changes",
    )
    remark = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("enrollment history")
        verbose_name_plural = _("enrollment histories")
        indexes = [
            models.Index(fields=["enrollment", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.enrollment_id}: {self.from_status} → {self.to_status}"


class EnrollmentDocument(TimeStampedModel):
    """Supporting documents attached to an enrollment."""

    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="enrollments/documents/%Y/%m/")
    doc_type = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("enrollment document")
        verbose_name_plural = _("enrollment documents")

    def __str__(self):
        return self.title

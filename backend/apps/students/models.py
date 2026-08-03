"""
Student domain models for ShikshaLab.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel, TimeStampedModel, UUIDPrimaryKeyModel


class Student(BaseModel):
    """One-to-one student profile linked to an accounts.User."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", _("Active")
        INACTIVE = "INACTIVE", _("Inactive")

    class BloodGroup(models.TextChoices):
        A_POS = "A+", _("A+")
        A_NEG = "A-", _("A-")
        B_POS = "B+", _("B+")
        B_NEG = "B-", _("B-")
        AB_POS = "AB+", _("AB+")
        AB_NEG = "AB-", _("AB-")
        O_POS = "O+", _("O+")
        O_NEG = "O-", _("O-")
        UNKNOWN = "UNKNOWN", _("Unknown")

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    student_id = models.CharField(max_length=50, unique=True, db_index=True)
    enrollment_number = models.CharField(max_length=50, blank=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deactivated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deactivated_students",
    )
    blood_group = models.CharField(
        max_length=10,
        choices=BloodGroup.choices,
        blank=True,
        default=BloodGroup.UNKNOWN,
    )
    nationality = models.CharField(max_length=100, blank=True)
    religion = models.CharField(max_length=100, blank=True)
    mother_tongue = models.CharField(max_length=100, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    admission_date = models.DateField(null=True, blank=True)
    profile_completed = models.BooleanField(default=False)

    # Address / personal info (first/middle/last live on User)
    permanent_address = models.TextField(blank=True)
    temporary_address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True, default="Nepal")
    postal_code = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("student")
        verbose_name_plural = _("students")
        indexes = [
            models.Index(fields=["status", "student_id"]),
            models.Index(fields=["enrollment_number"]),
        ]

    def __str__(self):
        return f"{self.student_id} — {self.user}"


class Guardian(BaseModel):
    """Guardian / parent associated with a student."""

    class Relationship(models.TextChoices):
        FATHER = "FATHER", _("Father")
        MOTHER = "MOTHER", _("Mother")
        GUARDIAN = "GUARDIAN", _("Guardian")
        SPOUSE = "SPOUSE", _("Spouse")
        SIBLING = "SIBLING", _("Sibling")
        OTHER = "OTHER", _("Other")

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="guardians",
    )
    name = models.CharField(max_length=150)
    relationship = models.CharField(
        max_length=20,
        choices=Relationship.choices,
        default=Relationship.GUARDIAN,
    )
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=150, blank=True)
    address = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_primary", "name"]
        verbose_name = _("guardian")
        verbose_name_plural = _("guardians")

    def __str__(self):
        return f"{self.name} ({self.relationship}) — {self.student.student_id}"


class AcademicHistory(BaseModel):
    """Prior academic record for a student."""

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="academic_history",
    )
    institution = models.CharField(max_length=255)
    degree_level = models.CharField(
        max_length=100,
        blank=True,
        help_text=_("Degree or level, e.g. SLC, +2, Bachelor."),
    )
    field_of_study = models.CharField(max_length=150, blank=True)
    year_from = models.PositiveIntegerField(null=True, blank=True)
    year_to = models.PositiveIntegerField(null=True, blank=True)
    grade_gpa = models.CharField(max_length=50, blank=True)
    documents = models.FileField(
        upload_to="students/academic/",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-year_to", "-year_from"]
        verbose_name = _("academic history")
        verbose_name_plural = _("academic histories")

    def __str__(self):
        return f"{self.institution} — {self.student.student_id}"


class StudentDocument(BaseModel):
    """Uploaded document belonging to a student."""

    class DocType(models.TextChoices):
        CITIZENSHIP = "CITIZENSHIP", _("Citizenship")
        PASSPORT = "PASSPORT", _("Passport")
        BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE", _("Birth Certificate")
        TRANSCRIPT = "TRANSCRIPT", _("Transcript")
        PHOTO = "PHOTO", _("Photo")
        OTHER = "OTHER", _("Other")

    student = models.ForeignKey(
        Student,
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
    file = models.FileField(upload_to="students/documents/")
    issued_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("student document")
        verbose_name_plural = _("student documents")

    def __str__(self):
        return f"{self.title} — {self.student.student_id}"


class StudentActivityLog(UUIDPrimaryKeyModel, TimeStampedModel):
    """
    Audit trail of actions performed on / by a student profile.

    Soft-delete is intentionally omitted so logs remain immutable.
    """

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="activity_logs",
    )
    action = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_activity_logs",
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("student activity log")
        verbose_name_plural = _("student activity logs")
        indexes = [
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.action} — {self.student.student_id}"

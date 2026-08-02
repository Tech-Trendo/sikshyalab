"""
Certificate issuance, templates, and verification logs.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class CertificateTemplatePurpose(models.TextChoices):
    COURSE_COMPLETION = "COURSE_COMPLETION", _("Course Completion")
    WORKSHOP = "WORKSHOP", _("Workshop")
    INTERNSHIP = "INTERNSHIP", _("Internship")
    SEMINAR = "SEMINAR", _("Seminar")
    BOOTCAMP = "BOOTCAMP", _("Bootcamp")
    PARTICIPATION = "PARTICIPATION", _("Participation")
    APPRECIATION = "APPRECIATION", _("Appreciation")


class CertificateTemplate(BaseModel):
    """Visual certificate template with configurable layout and assets."""

    name = models.CharField(max_length=200)
    purpose = models.CharField(
        max_length=30,
        choices=CertificateTemplatePurpose.choices,
        default=CertificateTemplatePurpose.COURSE_COMPLETION,
        db_index=True,
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificate_templates",
        help_text=_("Null means a global template."),
    )
    html_template = models.TextField(
        help_text=_("HTML body with placeholders for certificate fields."),
    )
    is_default = models.BooleanField(default=False, db_index=True)
    header_image = models.ImageField(
        upload_to="certificates/templates/headers/",
        null=True,
        blank=True,
    )
    background_image = models.ImageField(
        upload_to="certificates/templates/backgrounds/",
        null=True,
        blank=True,
    )
    logo_image = models.ImageField(
        upload_to="certificates/templates/logos/",
        null=True,
        blank=True,
    )
    seal_image = models.ImageField(
        upload_to="certificates/templates/seals/",
        null=True,
        blank=True,
    )
    director_signature = models.ImageField(
        upload_to="certificates/templates/signatures/",
        null=True,
        blank=True,
    )
    instructor_signature = models.ImageField(
        upload_to="certificates/templates/signatures/",
        null=True,
        blank=True,
    )
    watermark_image = models.ImageField(
        upload_to="certificates/templates/watermarks/",
        null=True,
        blank=True,
    )
    footer_text = models.CharField(max_length=500, blank=True)
    design_config = models.JSONField(
        default=dict,
        blank=True,
        help_text=_(
            "Field positions, typography, and layout metadata for dynamic rendering."
        ),
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-is_default", "name"]
        verbose_name = _("certificate template")
        verbose_name_plural = _("certificate templates")
        indexes = [
            models.Index(fields=["is_active", "is_default"]),
        ]

    def __str__(self):
        scope = self.course_id or "global"
        return f"{self.name} ({scope})"

    def save(self, *args, **kwargs):
        if self.is_default:
            qs = CertificateTemplate.all_objects.filter(is_default=True)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if self.course_id:
                qs = qs.filter(course_id=self.course_id)
            else:
                qs = qs.filter(course__isnull=True)
            qs.update(is_default=False)
        super().save(*args, **kwargs)


class Certificate(BaseModel):
    """Issued certificate for a student who completed a course."""

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending Generation")
        ISSUED = "ISSUED", _("Issued")
        REVOKED = "REVOKED", _("Revoked")
        EXPIRED = "EXPIRED", _("Expired")

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="certificates",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="certificates",
    )
    enrollment = models.ForeignKey(
        "enrollments.Enrollment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificates",
    )
    batch = models.ForeignKey(
        "batches.Batch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificates",
    )
    certificate_number = models.CharField(max_length=50, unique=True, db_index=True)
    verification_code = models.CharField(max_length=64, unique=True, db_index=True)
    qr_code = models.ImageField(
        upload_to="certificates/qr/",
        null=True,
        blank=True,
    )
    issue_date = models.DateField()
    completion_date = models.DateField()
    grade_or_score = models.CharField(max_length=50, null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ISSUED,
        db_index=True,
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_certificates",
    )
    pdf_file = models.FileField(
        upload_to="certificates/pdf/",
        null=True,
        blank=True,
    )
    metadata = models.JSONField(default=dict, blank=True)
    template = models.ForeignKey(
        CertificateTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificates",
    )

    class Meta:
        ordering = ["-issue_date", "-created_at"]
        verbose_name = _("certificate")
        verbose_name_plural = _("certificates")
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course", "status"]),
            models.Index(fields=["status", "issue_date"]),
        ]

    def __str__(self):
        return f"{self.certificate_number} — {self.student_id}"

    @property
    def is_valid(self) -> bool:
        return self.status == self.Status.ISSUED and not self.is_deleted


class CertificateVerificationLog(BaseModel):
    """Audit log of public certificate verification attempts."""

    certificate = models.ForeignKey(
        Certificate,
        on_delete=models.CASCADE,
        related_name="verification_logs",
    )
    verified_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    is_valid = models.BooleanField(default=True)

    class Meta:
        ordering = ["-verified_at"]
        verbose_name = _("certificate verification log")
        verbose_name_plural = _("certificate verification logs")
        indexes = [
            models.Index(fields=["certificate", "-verified_at"]),
        ]

    def __str__(self):
        return f"Verify {self.certificate_id} @ {self.verified_at}"


class CertificateSettings(models.Model):
    """Singleton-style institute certificate configuration."""

    numbering_prefix = models.CharField(max_length=20, default="SL")
    numbering_format = models.CharField(
        max_length=100,
        default="{prefix}-{year}-{suffix}",
        help_text=_("Placeholders: {prefix}, {year}, {suffix}, {sequence}"),
    )
    verification_base_url = models.URLField(blank=True)
    qr_size = models.PositiveSmallIntegerField(default=120)
    qr_embed_logo = models.BooleanField(default=False)
    default_template = models.ForeignKey(
        CertificateTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    institute_name = models.CharField(max_length=255, default="ShikshaLab")
    institute_tagline = models.CharField(max_length=500, blank=True)
    institute_address = models.TextField(blank=True)
    institute_website = models.URLField(blank=True)
    institute_email = models.EmailField(blank=True)
    institute_phone = models.CharField(max_length=30, blank=True)
    institute_logo = models.ImageField(
        upload_to="certificates/settings/",
        null=True,
        blank=True,
    )
    auto_generate_on_completion = models.BooleanField(default=False)
    email_on_issue = models.BooleanField(default=False)
    allow_public_verification = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("certificate settings")
        verbose_name_plural = _("certificate settings")

    def __str__(self):
        return "Certificate settings"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

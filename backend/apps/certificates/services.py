"""
Certificate generation utilities: numbers, verification codes, and QR images.
"""

from __future__ import annotations

import io
import secrets
from datetime import date

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.certificates.models import (
    Certificate,
    CertificateSettings,
    CertificateTemplate,
    CertificateVerificationLog,
)


def _certificate_settings() -> CertificateSettings:
    return CertificateSettings.get_solo()


def generate_certificate_number(year: int | None = None) -> str:
    """
    Generate a unique certificate number using institute settings.

    Default format: ``SL-2026-A1B2C3``.
    """
    settings_obj = _certificate_settings()
    year = year or timezone.now().year
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(50):
        suffix = "".join(secrets.choice(alphabet) for _ in range(6))
        number = settings_obj.numbering_format.format(
            prefix=settings_obj.numbering_prefix,
            year=year,
            suffix=suffix,
            sequence=suffix,
        )
        if not Certificate.all_objects.filter(certificate_number=number).exists():
            return number
    raise RuntimeError("Unable to generate a unique certificate number.")


def generate_verification_code() -> str:
    """Generate a URL-safe unique verification code."""
    for _ in range(50):
        code = secrets.token_urlsafe(24)
        if not Certificate.all_objects.filter(verification_code=code).exists():
            return code
    raise RuntimeError("Unable to generate a unique verification code.")


def get_verification_url(verification_code: str) -> str:
    """
    Build the public verification URL embedded in the QR code.

    Prefers ``CERTIFICATE_VERIFY_BASE_URL`` / ``FRONTEND_URL``, otherwise
    falls back to the API verify path under ``SITE_URL``.
    """
    base = getattr(settings, "CERTIFICATE_VERIFY_BASE_URL", None) or getattr(
        settings, "FRONTEND_URL", None
    )
    settings_obj = _certificate_settings()
    if settings_obj.verification_base_url:
        base = settings_obj.verification_base_url
    if base:
        return f"{str(base).rstrip('/')}/verify?code={verification_code}"

    site = getattr(settings, "SITE_URL", "http://localhost:8000").rstrip("/")
    return f"{site}/api/v1/certificates/verify/{verification_code}/"


def generate_qr_code_image(verification_code: str) -> ContentFile:
    """Create a PNG QR code pointing at the verification URL."""
    url = get_verification_url(verification_code)
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    filename = f"qr_{verification_code[:16]}.png"
    return ContentFile(buffer.read(), name=filename)


def resolve_template(course, template=None) -> CertificateTemplate | None:
    """Resolve an active template for issuance."""
    if template is not None and template.is_active:
        return template

    settings_obj = _certificate_settings()
    if settings_obj.default_template_id and settings_obj.default_template.is_active:
        return settings_obj.default_template

    if course is not None:
        tpl = (
            CertificateTemplate.objects.filter(
                course=course, is_active=True, is_default=True
            )
            .order_by("-created_at")
            .first()
        )
        if tpl:
            return tpl
        tpl = (
            CertificateTemplate.objects.filter(course=course, is_active=True)
            .order_by("-is_default", "-created_at")
            .first()
        )
        if tpl:
            return tpl

    tpl = (
        CertificateTemplate.objects.filter(
            course__isnull=True, is_active=True, is_default=True
        )
        .order_by("-created_at")
        .first()
    )
    if tpl:
        return tpl
    return (
        CertificateTemplate.objects.filter(course__isnull=True, is_active=True)
        .order_by("-is_default", "-created_at")
        .first()
    )


def attach_qr_code(certificate: Certificate, save: bool = True) -> Certificate:
    """Generate and attach a QR code image for the certificate."""
    content = generate_qr_code_image(certificate.verification_code)
    certificate.qr_code.save(content.name, content, save=False)
    if save:
        certificate.save(update_fields=["qr_code", "updated_at"])
    return certificate


@transaction.atomic
def generate_certificate_on_completion(
    *,
    student,
    course,
    enrollment=None,
    batch=None,
    issued_by=None,
    completion_date: date | None = None,
    grade_or_score: str | None = None,
    title: str | None = None,
    description: str = "",
    metadata: dict | None = None,
    template=None,
    force: bool = False,
    certificate_number: str | None = None,
) -> Certificate:
    """
    Issue a certificate when a student completes a course.

    If an ISSUED certificate already exists for the student+course and
    ``force`` is False, returns the existing record.
    """
    existing = (
        Certificate.objects.filter(
            student=student,
            course=course,
            status=Certificate.Status.ISSUED,
        )
        .order_by("-issue_date")
        .first()
    )
    if existing and not force:
        return existing

    completion = completion_date or timezone.now().date()
    if enrollment is not None and getattr(enrollment, "completed_at", None):
        completion = enrollment.completed_at.date()

    resolved_batch = batch
    if resolved_batch is None and enrollment is not None:
        resolved_batch = getattr(enrollment, "batch", None)

    number = (certificate_number or "").strip()
    if number:
        if Certificate.all_objects.filter(certificate_number__iexact=number).exists():
            raise ValueError(f"Certificate number '{number}' is already in use.")
    else:
        number = generate_certificate_number()

    cert_title = title or f"Certificate of Completion — {course.title}"
    cert = Certificate(
        student=student,
        course=course,
        enrollment=enrollment,
        batch=resolved_batch,
        certificate_number=number,
        verification_code=generate_verification_code(),
        issue_date=timezone.now().date(),
        completion_date=completion,
        grade_or_score=grade_or_score,
        title=cert_title,
        description=description
        or f"Awarded for successful completion of {course.title}.",
        status=Certificate.Status.ISSUED,
        issued_by=issued_by,
        metadata=metadata or {},
        template=resolve_template(course, template=template),
    )
    cert.save()
    attach_qr_code(cert, save=True)
    return cert


@transaction.atomic
def regenerate_qr(certificate: Certificate) -> Certificate:
    """Regenerate the QR code image (e.g. after URL base change)."""
    if certificate.qr_code:
        certificate.qr_code.delete(save=False)
    return attach_qr_code(certificate, save=True)


@transaction.atomic
def revoke_certificate(certificate: Certificate, reason: str = "") -> Certificate:
    """Mark a certificate as revoked."""
    certificate.status = Certificate.Status.REVOKED
    meta = dict(certificate.metadata or {})
    if reason:
        meta["revoke_reason"] = reason
        meta["revoked_at"] = timezone.now().isoformat()
    certificate.metadata = meta
    certificate.save(update_fields=["status", "metadata", "updated_at"])
    return certificate


def dashboard_stats() -> dict:
    """Aggregate stats for the certificate management dashboard."""
    from django.db.models import Count
    from django.db.models.functions import TruncMonth

    qs = Certificate.objects.filter(is_deleted=False)
    total_issued = qs.filter(status=Certificate.Status.ISSUED).count()
    pending = qs.filter(status=Certificate.Status.PENDING).count()
    verified_count = CertificateVerificationLog.objects.filter(is_valid=True).count()
    templates_count = CertificateTemplate.objects.filter(
        is_active=True, is_deleted=False
    ).count()

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = qs.filter(
        status=Certificate.Status.ISSUED,
        issue_date__gte=month_start.date(),
    ).count()

    monthly = (
        qs.filter(status=Certificate.Status.ISSUED)
        .annotate(month=TruncMonth("issue_date"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    monthly_data = [
        {
            "month": row["month"].strftime("%b %Y") if row["month"] else "",
            "count": row["count"],
        }
        for row in monthly
    ]

    return {
        "total_issued": total_issued,
        "pending_generation": pending,
        "templates_count": templates_count,
        "verified_certificates": verified_count,
        "issued_this_month": this_month,
        "monthly_generation": monthly_data,
        "by_status": dict(qs.values("status").annotate(count=Count("id")).values_list("status", "count")),
    }


@transaction.atomic
def bulk_generate_certificates(
    *,
    course,
    batch=None,
    student_ids=None,
    template=None,
    issued_by=None,
    completion_date: date | None = None,
    grade_or_score: str | None = None,
    force: bool = False,
) -> list[Certificate]:
    """Generate certificates for a batch or explicit student list."""
    from apps.students.models import Student

    students_qs = Student.objects.all()
    if student_ids:
        students_qs = students_qs.filter(pk__in=student_ids)
    elif batch is not None:
        batch_students = getattr(batch, "batch_students", None)
        if batch_students is not None:
            students_qs = Student.objects.filter(
                pk__in=batch_students.values_list("student_id", flat=True)
            )
        else:
            students_qs = Student.objects.none()

    created: list[Certificate] = []
    for student in students_qs.distinct():
        cert = generate_certificate_on_completion(
            student=student,
            course=course,
            batch=batch,
            issued_by=issued_by,
            completion_date=completion_date,
            grade_or_score=grade_or_score,
            template=template,
            force=force,
        )
        created.append(cert)
    return created

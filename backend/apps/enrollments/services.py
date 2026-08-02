"""
Enrollment workflow helpers.
"""

from django.db import transaction
from django.utils import timezone

from apps.common.utils import generate_unique_code
from apps.enrollments.models import Enrollment, EnrollmentHistory


def generate_enrollment_number() -> str:
    """Generate a unique enrollment number like ENR-XXXXXXXX."""
    for _ in range(10):
        code = generate_unique_code(prefix="ENR", length=8)
        if not Enrollment.objects.filter(enrollment_number=code).exists():
            return code
    return generate_unique_code(prefix="ENR", length=12)


def record_status_change(
    enrollment: Enrollment,
    *,
    from_status: str,
    to_status: str,
    changed_by=None,
    remark: str = "",
) -> EnrollmentHistory:
    return EnrollmentHistory.objects.create(
        enrollment=enrollment,
        from_status=from_status or "",
        to_status=to_status,
        changed_by=changed_by,
        remark=remark,
    )


@transaction.atomic
def transition_enrollment(
    enrollment: Enrollment,
    *,
    to_status: str,
    changed_by=None,
    remark: str = "",
    rejection_reason: str = "",
) -> Enrollment:
    """
    Apply a status transition, write history, and side-effects
    (batch membership on ACTIVE, timestamps, etc.).
    """
    from_status = enrollment.status
    if from_status == to_status:
        return enrollment

    now = timezone.now()
    enrollment.status = to_status
    update_fields = ["status", "updated_at"]

    if to_status == Enrollment.Status.APPROVED:
        enrollment.approved_by = changed_by
        enrollment.approved_at = now
        update_fields.extend(["approved_by", "approved_at"])
        # Approved immediately becomes ACTIVE for operational use
        # unless caller already asked for APPROVED specifically —
        # keep APPROVED as distinct intermediate when requested.
    elif to_status == Enrollment.Status.ACTIVE:
        if enrollment.approved_at is None:
            enrollment.approved_by = changed_by
            enrollment.approved_at = now
            update_fields.extend(["approved_by", "approved_at"])
        if enrollment.enrolled_at is None:
            enrollment.enrolled_at = now
            update_fields.append("enrolled_at")
        if enrollment.batch_id:
            from apps.batches.services import add_student_to_batch

            add_student_to_batch(
                batch=enrollment.batch,
                student=enrollment.student,
                notes=f"Enrollment {enrollment.enrollment_number}",
            )
    elif to_status == Enrollment.Status.REJECTED:
        enrollment.rejection_reason = rejection_reason or remark
        update_fields.append("rejection_reason")
    elif to_status == Enrollment.Status.COMPLETED:
        enrollment.completed_at = now
        update_fields.append("completed_at")
    elif to_status == Enrollment.Status.CANCELLED:
        if enrollment.batch_id:
            from apps.batches.services import drop_student_from_batch

            drop_student_from_batch(
                batch=enrollment.batch,
                student=enrollment.student,
                notes=f"Enrollment cancelled: {enrollment.enrollment_number}",
            )

    enrollment.save(update_fields=list(dict.fromkeys(update_fields)))
    record_status_change(
        enrollment,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        remark=remark or rejection_reason,
    )
    return enrollment


@transaction.atomic
def approve_enrollment(enrollment: Enrollment, *, changed_by=None, remark: str = "") -> Enrollment:
    """PENDING → APPROVED → ACTIVE (operational activation)."""
    if enrollment.status not in (
        Enrollment.Status.PENDING,
        Enrollment.Status.APPROVED,
    ):
        raise ValueError(
            f"Cannot approve enrollment in status {enrollment.status}."
        )
    # Mark approved then activate so history captures both steps when from PENDING
    if enrollment.status == Enrollment.Status.PENDING:
        transition_enrollment(
            enrollment,
            to_status=Enrollment.Status.APPROVED,
            changed_by=changed_by,
            remark=remark or "Approved",
        )
        enrollment.refresh_from_db()
    enrollment = transition_enrollment(
        enrollment,
        to_status=Enrollment.Status.ACTIVE,
        changed_by=changed_by,
        remark=remark or "Activated",
    )
    try:
        from apps.fees.services import ensure_student_fee_for_enrollment

        ensure_student_fee_for_enrollment(enrollment)
    except Exception:
        pass
    return enrollment


@transaction.atomic
def reject_enrollment(
    enrollment: Enrollment,
    *,
    changed_by=None,
    reason: str = "",
) -> Enrollment:
    if enrollment.status != Enrollment.Status.PENDING:
        raise ValueError("Only PENDING enrollments can be rejected.")
    return transition_enrollment(
        enrollment,
        to_status=Enrollment.Status.REJECTED,
        changed_by=changed_by,
        remark=reason,
        rejection_reason=reason,
    )


@transaction.atomic
def cancel_enrollment(
    enrollment: Enrollment,
    *,
    changed_by=None,
    remark: str = "",
) -> Enrollment:
    if enrollment.status in (
        Enrollment.Status.COMPLETED,
        Enrollment.Status.CANCELLED,
        Enrollment.Status.REJECTED,
    ):
        raise ValueError(f"Cannot cancel enrollment in status {enrollment.status}.")
    return transition_enrollment(
        enrollment,
        to_status=Enrollment.Status.CANCELLED,
        changed_by=changed_by,
        remark=remark or "Cancelled",
    )


@transaction.atomic
def complete_enrollment(
    enrollment: Enrollment,
    *,
    changed_by=None,
    remark: str = "",
) -> Enrollment:
    if enrollment.status != Enrollment.Status.ACTIVE:
        raise ValueError("Only ACTIVE enrollments can be completed.")
    return transition_enrollment(
        enrollment,
        to_status=Enrollment.Status.COMPLETED,
        changed_by=changed_by,
        remark=remark or "Completed",
    )

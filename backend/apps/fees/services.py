"""Fee helpers — keep StudentFee rows in sync with enrollments / course prices."""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone


def _course_amount(course) -> Decimal:
    if course is None:
        return Decimal("0.00")
    price = getattr(course, "discount_price", None)
    if price in (None, ""):
        price = getattr(course, "price", None)
    try:
        return Decimal(str(price or 0))
    except Exception:
        return Decimal("0.00")


def get_or_create_fee_structure_for_course(course):
    """Active FeeStructure for a course, created from the course price if missing."""
    from apps.fees.models import FeeStructure

    if course is None:
        raise ValueError("course is required")

    amount = _course_amount(course)
    existing = (
        FeeStructure.objects.filter(course=course, is_active=True)
        .order_by("-created_at")
        .first()
    )
    if existing:
        # Keep structure amount aligned with current course price when unused name is default.
        if existing.total_amount != amount:
            existing.total_amount = amount
            existing.save(update_fields=["total_amount", "updated_at"])
        return existing

    return FeeStructure.objects.create(
        course=course,
        name=f"{course.title} — Standard fee",
        total_amount=amount,
        description=f"Auto-created fee structure for {course.title}",
        is_active=True,
        applicable_from=timezone.now().date(),
    )


@transaction.atomic
def ensure_student_fee_for_enrollment(enrollment, *, reset_paid: bool = False):
    """
    Ensure a StudentFee exists for this enrollment and matches the course price.

    - Creates FeeStructure + StudentFee when missing.
    - Updates total/course when the enrollment course/amount changes.
    - Does not wipe paid_amount unless reset_paid=True (e.g. brand-new enrollment).
    """
    from apps.fees.models import StudentFee

    if enrollment is None:
        return None

    student = enrollment.student
    course = enrollment.course
    if student is None or course is None:
        return None

    amount = enrollment.final_amount or enrollment.amount or _course_amount(course)
    try:
        amount = Decimal(str(amount or 0))
    except Exception:
        amount = Decimal("0.00")

    structure = get_or_create_fee_structure_for_course(course)

    fee = (
        StudentFee.objects.filter(enrollment=enrollment)
        .select_for_update()
        .first()
    )
    if fee is None:
        fee = (
            StudentFee.objects.filter(student=student, course=course)
            .order_by("-created_at")
            .select_for_update()
            .first()
        )

    if fee is None:
        fee = StudentFee.objects.create(
            student=student,
            enrollment=enrollment,
            fee_structure=structure,
            course=course,
            total_amount=amount,
            discount_amount=Decimal("0.00"),
            scholarship_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            notes=f"Auto-created for enrollment {enrollment.enrollment_number}",
        )
        fee.recalculate_amounts(save=True)
        return fee

    fee.enrollment = enrollment
    fee.course = course
    fee.fee_structure = structure
    fee.total_amount = amount
    if reset_paid:
        fee.paid_amount = Decimal("0.00")
        fee.discount_amount = Decimal("0.00")
        fee.scholarship_amount = Decimal("0.00")
    fee.save(
        update_fields=[
            "enrollment",
            "course",
            "fee_structure",
            "total_amount",
            "paid_amount",
            "discount_amount",
            "scholarship_amount",
            "updated_at",
        ]
    )
    fee.recalculate_amounts(save=True)
    return fee


def backfill_student_fees():
    """Create missing StudentFee rows for all active enrollments."""
    from apps.enrollments.models import Enrollment

    active = Enrollment.objects.filter(
        status__in=[
            Enrollment.Status.PENDING,
            Enrollment.Status.APPROVED,
            Enrollment.Status.ACTIVE,
            Enrollment.Status.SUSPENDED,
        ]
    ).select_related("student", "course")
    from apps.fees.models import StudentFee

    created = 0
    for enrollment in active:
        before = StudentFee.objects.filter(enrollment=enrollment).exists()
        fee = ensure_student_fee_for_enrollment(enrollment)
        if fee and not before:
            created += 1
    return created

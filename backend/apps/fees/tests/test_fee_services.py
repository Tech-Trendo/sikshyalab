"""Fee sync helpers (behavior lock)."""

from decimal import Decimal

import pytest

from apps.fees.models import StudentFee
from apps.fees.services import (
    ensure_student_fee_for_enrollment,
    get_or_create_fee_structure_for_course,
)


@pytest.mark.django_db
class TestFeeServices:
    def test_fee_structure_from_course_discount_price(self, course):
        structure = get_or_create_fee_structure_for_course(course)
        assert structure.total_amount == Decimal("8000.00")
        assert structure.course_id == course.pk
        # Idempotent
        again = get_or_create_fee_structure_for_course(course)
        assert again.pk == structure.pk

    def test_ensure_student_fee_creates_row(self, pending_enrollment):
        fee = ensure_student_fee_for_enrollment(pending_enrollment)
        assert fee is not None
        assert fee.student_id == pending_enrollment.student_id
        assert fee.enrollment_id == pending_enrollment.pk
        assert fee.total_amount == Decimal("8000.00")
        assert fee.status == StudentFee.Status.PENDING

    def test_ensure_student_fee_preserves_paid_amount_on_rerun(
        self, pending_enrollment
    ):
        """Re-running ensure must not wipe paid_amount (reset_paid=False)."""
        fee = ensure_student_fee_for_enrollment(pending_enrollment)
        fee.paid_amount = Decimal("1000.00")
        fee.save(update_fields=["paid_amount", "updated_at"])
        fee.recalculate_amounts(save=True)
        assert fee.status == StudentFee.Status.PARTIAL

        updated = ensure_student_fee_for_enrollment(pending_enrollment)
        assert updated.pk == fee.pk
        assert updated.paid_amount == Decimal("1000.00")
        assert updated.status == StudentFee.Status.PARTIAL

    def test_ensure_student_fee_reset_paid_clears_payments(self, pending_enrollment):
        fee = ensure_student_fee_for_enrollment(pending_enrollment)
        fee.paid_amount = Decimal("1000.00")
        fee.save(update_fields=["paid_amount", "updated_at"])
        fee.recalculate_amounts(save=True)

        updated = ensure_student_fee_for_enrollment(
            pending_enrollment, reset_paid=True
        )
        assert updated.pk == fee.pk
        assert updated.paid_amount == Decimal("0.00")
        assert updated.status == StudentFee.Status.PENDING

    def test_ensure_none_enrollment_returns_none(self):
        assert ensure_student_fee_for_enrollment(None) is None

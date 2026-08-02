"""Enrollment workflow service tests (behavior lock)."""

import pytest
from apps.enrollments.models import Enrollment, EnrollmentHistory
from apps.enrollments.services import (
    approve_enrollment,
    cancel_enrollment,
    complete_enrollment,
    reject_enrollment,
)
from apps.fees.models import StudentFee


@pytest.mark.django_db
class TestEnrollmentWorkflow:
    def test_approve_pending_becomes_active_and_creates_fee(
        self, pending_enrollment, admin_user
    ):
        enrollment = approve_enrollment(
            pending_enrollment, changed_by=admin_user, remark="ok"
        )
        assert enrollment.status == Enrollment.Status.ACTIVE
        assert EnrollmentHistory.objects.filter(enrollment=enrollment).count() >= 2
        fee = StudentFee.objects.filter(enrollment=enrollment).first()
        assert fee is not None
        assert fee.total_amount == enrollment.final_amount

    def test_reject_pending(self, pending_enrollment, admin_user):
        enrollment = reject_enrollment(
            pending_enrollment, changed_by=admin_user, reason="full"
        )
        assert enrollment.status == Enrollment.Status.REJECTED
        assert enrollment.rejection_reason == "full"

    def test_cannot_reject_non_pending(self, pending_enrollment, admin_user):
        approve_enrollment(pending_enrollment, changed_by=admin_user)
        with pytest.raises(ValueError, match="PENDING"):
            reject_enrollment(pending_enrollment, changed_by=admin_user, reason="x")

    def test_complete_active(self, pending_enrollment, admin_user):
        enrollment = approve_enrollment(pending_enrollment, changed_by=admin_user)
        enrollment = complete_enrollment(enrollment, changed_by=admin_user)
        assert enrollment.status == Enrollment.Status.COMPLETED

    def test_cancel_active(self, pending_enrollment, admin_user):
        enrollment = approve_enrollment(pending_enrollment, changed_by=admin_user)
        enrollment = cancel_enrollment(enrollment, changed_by=admin_user)
        assert enrollment.status == Enrollment.Status.CANCELLED

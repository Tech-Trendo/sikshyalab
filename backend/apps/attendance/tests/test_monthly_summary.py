"""Attendance monthly summary helpers (behavior lock)."""

from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.attendance.models import StudentAttendance
from apps.attendance.serializers import build_student_monthly_summary
from apps.batches.models import Batch


@pytest.fixture
def batch(db, course, teacher_user):
    return Batch.objects.create(
        code="ATT-B1",
        name="Attendance Batch",
        course=course,
        teacher=teacher_user.teacher_profile,
        start_date=timezone.localdate(),
    )


@pytest.mark.django_db
class TestStudentMonthlySummary:
    def test_empty_month(self, student_user, batch):
        student = student_user.student_profile
        summary = build_student_monthly_summary(
            student, month=1, year=2026, batch_id=batch.pk
        )
        assert summary.total_days == 0
        assert summary.attendance_percentage == Decimal("0.00")

    def test_aggregates_statuses(self, student_user, course, batch, admin_user):
        student = student_user.student_profile
        year, month = 2026, 3
        days = [
            (date(year, month, 1), StudentAttendance.Status.PRESENT),
            (date(year, month, 2), StudentAttendance.Status.ABSENT),
            (date(year, month, 3), StudentAttendance.Status.LATE),
            (date(year, month, 4), StudentAttendance.Status.HALF_DAY),
        ]
        for d, st in days:
            StudentAttendance.objects.create(
                student=student,
                batch=batch,
                course=course,
                date=d,
                status=st,
                marked_by=admin_user,
            )

        summary = build_student_monthly_summary(
            student, month=month, year=year, batch_id=batch.pk
        )
        assert summary.total_days == 4
        assert summary.present_days == 1
        assert summary.absent_days == 1
        assert summary.late_days == 1
        # effective = 1 + 1 + 0 + 0.5 = 2.5 → 62.5%
        assert summary.attendance_percentage == Decimal("62.50")

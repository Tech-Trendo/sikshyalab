"""Assignment allocation visibility helpers (behavior lock)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.assignments.models import Assignment, AssignmentAllocation
from apps.assignments.views import student_is_allocated
from apps.batches.models import Batch, BatchStudent


@pytest.fixture
def teacher_profile(teacher_user):
    return teacher_user.teacher_profile


@pytest.fixture
def assignment(db, course, teacher_profile):
    return Assignment.objects.create(
        title="Week 1 Lab",
        description="Intro",
        course=course,
        teacher=teacher_profile,
        due_date=timezone.now() + timedelta(days=7),
        max_marks=Decimal("100.00"),
        status=Assignment.Status.PUBLISHED,
    )


@pytest.mark.django_db
class TestStudentAllocation:
    def test_not_allocated_when_no_links(self, assignment, student_user):
        student = student_user.student_profile
        assert student_is_allocated(assignment, student) is False

    def test_allocated_by_student_row(self, assignment, student_user):
        student = student_user.student_profile
        AssignmentAllocation.objects.create(
            assignment=assignment,
            student=student,
        )
        assert student_is_allocated(assignment, student) is True

    def test_allocated_via_batch_membership(
        self, assignment, student_user, course, teacher_profile
    ):
        student = student_user.student_profile
        batch = Batch.objects.create(
            code="PY-MORNING",
            name="Python Morning",
            course=course,
            teacher=teacher_profile,
            start_date=timezone.localdate(),
        )
        BatchStudent.objects.create(batch=batch, student=student)
        AssignmentAllocation.objects.create(
            assignment=assignment,
            batch=batch,
        )
        assert student_is_allocated(assignment, student) is True

    def test_fallback_to_assignment_batch_when_no_allocations(
        self, assignment, student_user, course, teacher_profile
    ):
        student = student_user.student_profile
        batch = Batch.objects.create(
            code="PY-EVE",
            name="Python Evening",
            course=course,
            teacher=teacher_profile,
            start_date=timezone.localdate(),
        )
        BatchStudent.objects.create(batch=batch, student=student)
        assignment.batch = batch
        assignment.save(update_fields=["batch", "updated_at"])
        assert student_is_allocated(assignment, student) is True

    def test_none_student(self, assignment):
        assert student_is_allocated(assignment, None) is False

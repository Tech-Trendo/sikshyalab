from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.assignments.models import Assignment, Submission
from apps.courses.models import Course
from apps.roles.models import Permission as RbacPermission
from apps.roles.models import Role as RbacRole
from apps.students.models import Student
from apps.teachers.models import Teacher


@pytest.mark.django_db
def test_teacher_download_requires_rbac_permission(
    admin_user,
    teacher_user,
    student_user,
    course: Course,
):
    # Build an assignment + a submission with a real PDF file on storage.
    teacher = teacher_user.teacher_profile
    student = student_user.student_profile

    assignment = Assignment.objects.create(
        title="RBAC Week 1 Lab",
        description="Submit a PDF",
        course=course,
        teacher=teacher,
        due_date=timezone.now() + timedelta(days=7),
        max_marks=Decimal("100.00"),
        status=Assignment.Status.PUBLISHED,
    )

    sub = Submission.objects.create(
        assignment=assignment,
        student=student,
        content="",
        attachment=SimpleUploadedFile(
            "submission.pdf", b"%PDF-1.4 test-rbac", content_type="application/pdf"
        ),
        status=Submission.Status.SUBMITTED,
        attempt_number=1,
    )

    url = f"/api/v1/assignments/submissions/{sub.id}/download/"

    # Ensure test sanity: teacher role normally has download permission.
    teacher_role = RbacRole.objects.get(name="Teacher")
    download_perm = RbacPermission.objects.get(codename="assignments.download")

    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(teacher_user).access_token}"
    )
    ok = client.get(url)
    assert ok.status_code == 200

    # Remove the permission: teacher should get 403.
    teacher_role.permissions.remove(download_perm)
    denied = client.get(url)
    assert denied.status_code == 403

    # Admin bypass should still allow download (regardless of teacher permissions).
    admin_client = APIClient()
    admin_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin_user).access_token}"
    )
    admin_ok = admin_client.get(url)
    assert admin_ok.status_code == 200

    # Restore the permission: teacher should get 200 again.
    teacher_role.permissions.add(download_perm)
    restored = client.get(url)
    assert restored.status_code == 200


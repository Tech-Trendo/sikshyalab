"""Admin create-user / provisioning critical path."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

from apps.accounts.provisioning import provision_user
from apps.enrollments.models import Enrollment
from apps.students.models import Student
from apps.teachers.models import Teacher

User = get_user_model()


@pytest.mark.django_db
class TestAdminCreateUserAPI:
    def test_requires_admin(self, api_client, student_user):
        from rest_framework_simplejwt.tokens import RefreshToken

        token = RefreshToken.for_user(student_user).access_token
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = api_client.post(
            "/api/v1/accounts/admin/create-user/",
            {
                "email": "newbie@test.shikshalab.io",
                "role": "STUDENT",
                "send_email": False,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_create_teacher(self, auth_client):
        res = auth_client.post(
            "/api/v1/accounts/admin/create-user/",
            {
                "email": "new.teacher@test.shikshalab.io",
                "role": "TEACHER",
                "first_name": "New",
                "last_name": "Teacher",
                "send_email": False,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["role"] == "TEACHER"
        assert res.data["temporary_password"]
        assert res.data["must_change_password"] is True
        user = User.objects.get(email="new.teacher@test.shikshalab.io")
        assert Teacher.objects.filter(user=user).exists()
        assert user.check_password(res.data["temporary_password"])

    def test_create_student_with_course(self, auth_client, course, admin_user):
        res = auth_client.post(
            "/api/v1/accounts/admin/create-user/",
            {
                "email": "new.student@test.shikshalab.io",
                "role": "STUDENT",
                "name": "New Student",
                "course": str(course.pk),
                "send_email": False,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["role"] == "STUDENT"
        assert res.data["student_id"]
        assert res.data["enrollment_id"]
        assert res.data["course"] == str(course.pk)

        user = User.objects.get(email="new.student@test.shikshalab.io")
        student = Student.objects.get(user=user)
        enrollment = Enrollment.objects.get(pk=res.data["enrollment_id"])
        assert enrollment.student_id == student.pk
        assert enrollment.status == Enrollment.Status.ACTIVE

    def test_duplicate_student_email_rejected(self, auth_client, student_user):
        res = auth_client.post(
            "/api/v1/accounts/admin/create-user/",
            {
                "email": student_user.email,
                "role": "STUDENT",
                "send_email": False,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestProvisionUserService:
    def test_invalid_role(self):
        with pytest.raises(ValueError, match="Invalid role"):
            provision_user(
                email="x@test.shikshalab.io",
                role="GUEST",
                send_email=False,
            )

    def test_role_conflict_on_existing_email(self, student_user):
        with pytest.raises(ValueError, match="already exists as STUDENT"):
            provision_user(
                email=student_user.email,
                role="TEACHER",
                send_email=False,
            )

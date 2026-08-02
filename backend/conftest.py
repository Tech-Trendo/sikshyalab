"""Shared fixtures for ShikshaLab API / service tests."""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.enrollments.services import generate_enrollment_number
from apps.students.models import Student

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.shikshalab.io",
        password="TestPass123!",
        role=User.Role.ADMIN,
        is_staff=True,
        is_superuser=True,
        first_name="Admin",
        last_name="User",
    )


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student@test.shikshalab.io",
        password="TestPass123!",
        role=User.Role.STUDENT,
        first_name="Stu",
        last_name="Dent",
    )
    Student.objects.create(user=user, student_id="STU-TEST-0001")
    return user


@pytest.fixture
def teacher_user(db):
    from apps.teachers.models import Teacher

    user = User.objects.create_user(
        email="teacher@test.shikshalab.io",
        password="TestPass123!",
        role=User.Role.TEACHER,
        first_name="Tea",
        last_name="Cher",
    )
    Teacher.objects.create(user=user, teacher_id="TCH-TEST-0001")
    return user


@pytest.fixture
def auth_client(api_client, admin_user):
    refresh = RefreshToken.for_user(admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def course(db):
    return Course.objects.create(
        title="Python Foundations",
        slug="python-foundations",
        price=Decimal("10000.00"),
        discount_price=Decimal("8000.00"),
        status=Course.Status.PUBLISHED,
        is_published=True,
    )


@pytest.fixture
def pending_enrollment(db, student_user, course):
    student = student_user.student_profile
    return Enrollment.objects.create(
        student=student,
        course=course,
        status=Enrollment.Status.PENDING,
        amount=Decimal("8000.00"),
        final_amount=Decimal("8000.00"),
        enrollment_number=generate_enrollment_number(),
    )

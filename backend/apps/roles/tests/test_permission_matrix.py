"""Named-role permission matrix API."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.roles.models import Permission, Role


MATRIX_URL = "/api/v1/roles/Teacher/permissions/"


def _matrix_body(response):
    body = response.json()
    assert body.get("success") is True, body
    return body["data"]


def _auth(client, user):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


@pytest.mark.django_db
def test_admin_can_get_teacher_matrix(auth_client):
    response = auth_client.get(MATRIX_URL)
    assert response.status_code == 200
    body = _matrix_body(response)
    assert body["role"] == "Teacher"
    modules = {row["module"]: row for row in body["modules"]}
    assert "courses" in modules
    assert "assignments" in modules
    assert set(modules["courses"]) >= {"module", "label", "can_view", "can_create", "can_edit", "can_delete"}
    assert modules["assignments"]["can_view"] is True
    assert modules["assignments"]["can_create"] is True
    assert modules["assignments"]["can_delete"] is False


@pytest.mark.django_db
def test_student_slug_works(auth_client):
    response = auth_client.get("/api/v1/roles/student/permissions/")
    assert response.status_code == 200
    assert _matrix_body(response)["role"] == "Student"


@pytest.mark.django_db
def test_unknown_role_404(auth_client):
    response = auth_client.get("/api/v1/roles/Admin/permissions/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_teacher_cannot_view_matrix(teacher_user):
    client = _auth(APIClient(), teacher_user)
    response = client.get(MATRIX_URL)
    assert response.status_code == 403


@pytest.mark.django_db
def test_anonymous_cannot_view_matrix(api_client):
    response = api_client.get(MATRIX_URL)
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_can_get_matrix_by_role_id(auth_client):
    role = Role.objects.get(name="Teacher")
    response = auth_client.get(f"/api/v1/roles/roles/{role.id}/permissions/")
    assert response.status_code == 200
    body = _matrix_body(response)
    assert body["role"] == "Teacher"
    assert len(body["modules"]) > 0


@pytest.mark.django_db
def test_all_modules_present_even_when_all_false(auth_client):
    """Every catalog module appears in the matrix, including all-false rows."""
    body = _matrix_body(auth_client.get(MATRIX_URL))
    catalog_modules = set(Permission.objects.values_list("module", flat=True).distinct())
    matrix_modules = {row["module"] for row in body["modules"]}
    assert catalog_modules == matrix_modules


@pytest.mark.django_db
def test_admin_can_patch_matrix(auth_client):
    role = Role.objects.get(name="Teacher")
    assert role.permissions.filter(codename="assignments.delete").exists() is False

    response = auth_client.patch(
        MATRIX_URL,
        {
            "modules": [
                {
                    "module": "assignments",
                    "can_view": True,
                    "can_create": True,
                    "can_edit": True,
                    "can_delete": True,
                }
            ]
        },
        format="json",
    )
    assert response.status_code == 200
    body = _matrix_body(response)
    row = next(r for r in body["modules"] if r["module"] == "assignments")
    assert row["can_delete"] is True
    assert Permission.objects.get(codename="assignments.delete") in role.permissions.all()

    # Extra flags such as grade must survive a CRUD patch.
    assert role.permissions.filter(codename="assignments.grade").exists()

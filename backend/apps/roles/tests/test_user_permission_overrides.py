from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.rbac import user_has_rbac_permission
from apps.roles.matrix import build_permission_matrix
from apps.roles.models import Permission, Role, UserPermissionOverride


User = get_user_model()


USER_MATRIX_URL_TEMPLATE = "/api/v1/users/{user_id}/permissions/"
ME_MATRIX_URL = "/api/v1/users/me/permissions/"


def _auth_as(client: APIClient, user: User) -> APIClient:
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.mark.django_db
def test_teacher_can_get_own_permissions_via_me(teacher_user):
    client = APIClient()
    _auth_as(client, teacher_user)
    response = client.get(ME_MATRIX_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["user_id"] == teacher_user.id
    assert data["role"] == "Teacher"
    assert len(data["modules"]) > 0
    assert "can_view" in data["modules"][0]


@pytest.mark.django_db
def test_student_can_get_own_permissions_via_me(student_user):
    client = APIClient()
    _auth_as(client, student_user)
    response = client.get(ME_MATRIX_URL)
    assert response.status_code == 200
    assert response.json()["data"]["role"] == "Student"


@pytest.mark.django_db
def test_anonymous_cannot_get_me_permissions(api_client):
    response = api_client.get(ME_MATRIX_URL)
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_teacher_cannot_get_other_user_permissions_via_admin_endpoint(teacher_user, student_user):
    client = APIClient()
    _auth_as(client, teacher_user)
    response = client.get(USER_MATRIX_URL_TEMPLATE.format(user_id=student_user.id))
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_effective_matrix_inherits_role_by_default(auth_client, teacher_user):
    response = auth_client.get(USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id))
    assert response.status_code == 200

    body = response.json()
    assert body["success"] is True
    data = body["data"]

    modules = {row["module"]: row for row in data["modules"]}
    assert modules

    teacher_role = Role.objects.get(name="Teacher")
    role_matrix = build_permission_matrix(teacher_role)
    role_modules = {row["module"]: row for row in role_matrix["modules"]}

    accounts = modules["accounts"]
    accounts_role = role_modules["accounts"]

    assert accounts["can_view"] == accounts_role["can_view"]
    assert accounts["can_view_is_override"] is False


@pytest.mark.django_db
def test_admin_can_override_and_remove_override_field(
    auth_client,
    teacher_user,
):
    # Pick a module that definitely exists in the catalog.
    module = "accounts"

    teacher_role = Role.objects.get(name="Teacher")
    role_matrix = build_permission_matrix(teacher_role)
    role_modules = {row["module"]: row for row in role_matrix["modules"]}
    role_can_view = role_modules[module]["can_view"]

    # Override: explicitly revoke accounts.view for THIS user only.
    response = auth_client.patch(
        USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id),
        {
            "modules": [
                {
                    "module": module,
                    "can_view": not role_can_view,
                    "can_create": None,
                    "can_edit": None,
                    "can_delete": None,
                }
            ]
        },
        format="json",
    )
    assert response.status_code == 200

    assert UserPermissionOverride.objects.filter(user=teacher_user, module=module).exists()
    override = UserPermissionOverride.objects.get(user=teacher_user, module=module)
    assert override.can_view is (not role_can_view)

    # Permission helper must respect overrides.
    assert user_has_rbac_permission(teacher_user, f"{module}.view") is (not role_can_view)

    response = auth_client.get(USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id))
    data = response.json()["data"]
    row = next(r for r in data["modules"] if r["module"] == module)
    assert row["can_view"] is (not role_can_view)
    assert row["can_view_is_override"] is True

    # Remove override (set all fields back to null) → inherit role defaults again.
    response = auth_client.patch(
        USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id),
        {
            "modules": [
                {
                    "module": module,
                    "can_view": None,
                    "can_create": None,
                    "can_edit": None,
                    "can_delete": None,
                }
            ]
        },
        format="json",
    )
    assert response.status_code == 200
    assert not UserPermissionOverride.objects.filter(user=teacher_user, module=module).exists()

    response = auth_client.get(USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id))
    data = response.json()["data"]
    row = next(r for r in data["modules"] if r["module"] == module)
    assert row["can_view"] == role_can_view
    assert row["can_view_is_override"] is False


@pytest.mark.django_db
def test_patch_accepts_modules_array_at_root(auth_client, teacher_user):
    """Clients sometimes POST the module array as the root JSON body."""
    response = auth_client.patch(
        USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id),
        [
            {
                "module": "accounts",
                "can_view": False,
                "can_create": None,
                "can_edit": None,
                "can_delete": None,
            }
        ],
        format="json",
    )
    assert response.status_code == 200
    row = next(r for r in response.json()["data"]["modules"] if r["module"] == "accounts")
    assert row["can_view"] is False


@pytest.mark.django_db
def test_patch_accepts_string_booleans(auth_client, teacher_user):
    response = auth_client.patch(
        USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id),
        {
            "modules": [
                {
                    "module": "accounts",
                    "can_view": "false",
                    "can_create": None,
                    "can_edit": None,
                    "can_delete": None,
                }
            ]
        },
        format="json",
    )
    assert response.status_code == 200
    row = next(r for r in response.json()["data"]["modules"] if r["module"] == "accounts")
    assert row["can_view"] is False
    assert row["can_view_is_override"] is True


@pytest.mark.django_db
def test_non_admin_cannot_view_or_edit_overrides(api_client, teacher_user):
    client = APIClient()
    _auth_as(client, teacher_user)

    response = client.get(USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id))
    assert response.status_code in (401, 403)

    response = client.patch(
        USER_MATRIX_URL_TEMPLATE.format(user_id=teacher_user.id),
        {"modules": [{"module": "accounts", "can_view": False, "can_create": None, "can_edit": None, "can_delete": None}]},
        format="json",
    )
    assert response.status_code in (401, 403)


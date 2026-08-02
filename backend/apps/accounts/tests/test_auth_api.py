"""Critical path: login, register gate, handoff create/consume."""

import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.mark.django_db
class TestAuthLogin:
    def test_login_success_returns_tokens(self, api_client, admin_user):
        res = api_client.post(
            "/api/v1/accounts/auth/login/",
            {"email": admin_user.email, "password": "TestPass123!"},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert "tokens" in res.data
        assert res.data["tokens"]["access"]
        assert res.data["tokens"]["refresh"]
        assert res.data["user"]["email"] == admin_user.email

    def test_login_invalid_credentials(self, api_client, admin_user):
        res = api_client.post(
            "/api/v1/accounts/auth/login/",
            {"email": admin_user.email, "password": "WrongPass999!"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_public_register_disabled(self, api_client):
        res = api_client.post(
            "/api/v1/accounts/auth/register/",
            {
                "email": "new@test.shikshalab.io",
                "password": "TestPass123!",
                "password_confirm": "TestPass123!",
            },
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestLoginHandoff:
    def test_handoff_create_and_consume_once(self, api_client, admin_user):
        refresh = RefreshToken.for_user(admin_user)
        access = str(refresh.access_token)
        refresh_s = str(refresh)

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        create = api_client.post(
            "/api/v1/accounts/auth/handoff/",
            {"access": access, "refresh": refresh_s},
            format="json",
        )
        assert create.status_code == status.HTTP_201_CREATED
        code = create.data["code"]
        assert code

        api_client.credentials()
        consume = api_client.post(
            "/api/v1/accounts/auth/handoff/consume/",
            {"code": code},
            format="json",
        )
        assert consume.status_code == status.HTTP_200_OK
        assert consume.data["access"] == access
        assert consume.data["refresh"] == refresh_s
        assert consume.data["email"] == admin_user.email

        # One-time: second consume fails
        again = api_client.post(
            "/api/v1/accounts/auth/handoff/consume/",
            {"code": code},
            format="json",
        )
        assert again.status_code == status.HTTP_400_BAD_REQUEST

    def test_handoff_requires_auth(self, api_client):
        res = api_client.post(
            "/api/v1/accounts/auth/handoff/",
            {"access": "x", "refresh": "y"},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_consume_missing_code(self, api_client):
        res = api_client.post(
            "/api/v1/accounts/auth/handoff/consume/",
            {},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_consume_expired_code(self, api_client):
        cache.delete("login_handoff:does-not-exist")
        res = api_client.post(
            "/api/v1/accounts/auth/handoff/consume/",
            {"code": "does-not-exist"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

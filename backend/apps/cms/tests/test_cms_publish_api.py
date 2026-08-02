"""CMS public publish filters (behavior lock)."""

import pytest
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cms.models import FAQ


@pytest.mark.django_db
class TestCMSFaqPublishFilter:
    def test_anonymous_sees_only_published(self, api_client):
        FAQ.objects.create(
            question="Visible?",
            answer="Yes",
            is_published=True,
            order=1,
        )
        FAQ.objects.create(
            question="Hidden?",
            answer="No",
            is_published=False,
            order=2,
        )

        res = api_client.get("/api/v1/cms/faqs/")
        assert res.status_code == status.HTTP_200_OK
        # DRF pagination or envelope — collect question strings
        payload = res.data
        if isinstance(payload, dict) and "data" in payload:
            rows = payload["data"]
            if isinstance(rows, dict) and "results" in rows:
                rows = rows["results"]
        elif isinstance(payload, dict) and "results" in payload:
            rows = payload["results"]
        else:
            rows = payload

        questions = {row["question"] for row in rows}
        assert "Visible?" in questions
        assert "Hidden?" not in questions

    def test_admin_sees_unpublished(self, api_client, admin_user):
        FAQ.objects.create(
            question="Draft FAQ",
            answer="Staff only",
            is_published=False,
            order=1,
        )
        token = RefreshToken.for_user(admin_user).access_token
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        res = api_client.get("/api/v1/cms/faqs/")
        assert res.status_code == status.HTTP_200_OK
        payload = res.data
        if isinstance(payload, dict) and "data" in payload:
            rows = payload["data"]
            if isinstance(rows, dict) and "results" in rows:
                rows = rows["results"]
        elif isinstance(payload, dict) and "results" in payload:
            rows = payload["results"]
        else:
            rows = payload

        questions = {row["question"] for row in rows}
        assert "Draft FAQ" in questions

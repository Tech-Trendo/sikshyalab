"""Tests for public SEO lookup."""

import pytest
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.seo.models import SEOMetadata

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_seo_lookup_path_home_returns_200_when_missing(api_client):
    """Homepage lookup must not 404 when no SEO row exists."""
    res = api_client.get("/api/v1/seo/lookup/", {"path": "/"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"] is None


@pytest.mark.django_db
def test_seo_lookup_path_home_returns_metadata(api_client, django_user_model):
    user = django_user_model.objects.create_user(
        email="seo-home@example.com",
        password="pass12345",
    )
    ct = ContentType.objects.get_for_model(User)
    SEOMetadata.objects.create(
        content_type=ct,
        object_id=str(user.pk),
        meta_title="Home | ShikshaLab",
        meta_description="Welcome to ShikshaLab",
        slug="home",
        canonical_url="/",
        is_indexed=True,
    )
    res = api_client.get("/api/v1/seo/lookup/", {"path": "/"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data is not None
    assert data["meta_title"] == "Home | ShikshaLab"
    assert data["canonical_url"] in ("/", "http://localhost:8081/", "http://testserver/")


@pytest.mark.django_db
def test_seo_lookup_path_absolute_canonical(api_client, django_user_model):
    user = django_user_model.objects.create_user(
        email="seo-abs@example.com",
        password="pass12345",
    )
    ct = ContentType.objects.get_for_model(User)
    SEOMetadata.objects.create(
        content_type=ct,
        object_id=str(user.pk),
        meta_title="About",
        slug="about",
        canonical_url="http://localhost:8081/about",
        is_indexed=True,
    )
    res = api_client.get("/api/v1/seo/lookup/", {"path": "/about"})
    assert res.status_code == 200
    assert res.json()["data"]["meta_title"] == "About"


@pytest.mark.django_db
def test_seo_lookup_route_registered(api_client):
    res = api_client.get("/api/v1/seo/lookup/", {"path": "/does-not-exist-page"})
    assert res.status_code == 200
    assert res.json()["data"] is None

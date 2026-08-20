"""Tests for hierarchical sitemap pages, public JSON API, and XML output."""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.seo.models import SitemapEntry
from apps.seo.sitemap_utils import canonical_url, would_create_cycle


def _page(**kwargs) -> SitemapEntry:
    defaults = {
        "title": kwargs.pop("title", "About"),
        "slug": kwargs.pop("slug", "about"),
        "url_path": kwargs.pop("url_path", "/about"),
        "page_type": kwargs.pop("page_type", SitemapEntry.PageType.PAGE),
        "is_published": kwargs.pop("is_published", True),
        "is_indexable": kwargs.pop("is_indexable", True),
        "priority": kwargs.pop("priority", Decimal("0.8")),
        "changefreq": kwargs.pop("changefreq", SitemapEntry.ChangeFreq.MONTHLY),
    }
    defaults.update(kwargs)
    return SitemapEntry.objects.create(**defaults)


class SitemapModelTests(TestCase):
    def test_create_sitemap_page_sets_defaults(self):
        page = SitemapEntry.objects.create(url_path="/contact")
        self.assertEqual(page.slug, "contact")
        self.assertEqual(page.title, "Contact")
        self.assertTrue(page.is_published)
        self.assertTrue(page.is_indexable)
        self.assertTrue(page.is_active)
        self.assertIsNotNone(page.lastmod)
        self.assertIsNotNone(page.updated_at)

    def test_update_page_syncs_is_active_and_lastmod(self):
        page = _page()
        original = page.lastmod
        page.title = "About Us"
        page.is_published = False
        page.save()
        page.refresh_from_db()
        self.assertFalse(page.is_active)
        self.assertGreaterEqual(page.lastmod, original)

    def test_parent_child_relationship(self):
        home = _page(title="Home", slug="home", url_path="/", priority=Decimal("1.0"))
        about = _page(title="About", slug="about", url_path="/about", parent=home)
        about.refresh_from_db()
        self.assertEqual(about.parent_id, home.pk)
        self.assertEqual(list(home.children.all()), [about])

    def test_nested_pages(self):
        home = _page(title="Home", slug="home", url_path="/")
        courses = _page(title="Courses", slug="courses", url_path="/courses", parent=home)
        python = _page(
            title="Python",
            slug="courses-python",
            url_path="/courses/python",
            page_type=SitemapEntry.PageType.COURSE,
            parent=courses,
        )
        self.assertEqual(python.parent.parent_id, home.pk)

    def test_duplicate_slug_rejected(self):
        _page(slug="about", url_path="/about")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                _page(slug="about", url_path="/about-us")

    def test_duplicate_url_path_rejected(self):
        _page(slug="about", url_path="/about")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                _page(slug="about-2", url_path="/about")

    def test_parent_cannot_be_self(self):
        page = _page()
        page.parent = page
        with self.assertRaises(ValidationError):
            page.clean()

    def test_circular_parent_rejected(self):
        a = _page(title="A", slug="a", url_path="/a")
        b = _page(title="B", slug="b", url_path="/b", parent=a)
        c = _page(title="C", slug="c", url_path="/c", parent=b)
        self.assertTrue(would_create_cycle(a, c))
        a.parent = c
        with self.assertRaises(ValidationError):
            a.clean()

    def test_invalid_url_path_rejected(self):
        with self.assertRaises(ValidationError):
            SitemapEntry.objects.create(url_path="/about?ref=1")

    @override_settings(FRONTEND_URL="https://example.com")
    def test_canonical_frontend_url(self):
        page = _page(url_path="/about", slug="about")
        self.assertEqual(canonical_url(page.url_path), "https://example.com/about")
        home = _page(title="Home", slug="home", url_path="/")
        self.assertEqual(canonical_url(home.url_path), "https://example.com/")


@override_settings(FRONTEND_URL="https://example.com")
class SitemapAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_public_tree_excludes_unpublished_and_noindex(self):
        home = _page(title="Home", slug="home", url_path="/", priority=Decimal("1.0"))
        _page(title="About", slug="about", url_path="/about", parent=home)
        _page(title="Draft", slug="draft", url_path="/draft", is_published=False, parent=home)
        _page(title="Hidden", slug="hidden", url_path="/hidden", is_indexable=False, parent=home)

        res = self.client.get("/api/v1/sitemap/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])
        roots = body["data"]
        self.assertEqual(len(roots), 1)
        self.assertEqual(roots[0]["slug"], "home")
        self.assertEqual(roots[0]["url"], "https://example.com/")
        child_slugs = {c["slug"] for c in roots[0]["children"]}
        self.assertEqual(child_slugs, {"about"})

    def test_public_tree_orphans_when_parent_unpublished(self):
        parent = _page(title="Secret", slug="secret", url_path="/secret", is_published=False)
        _page(title="Visible", slug="visible", url_path="/visible", parent=parent)
        res = self.client.get("/api/v1/sitemap/")
        slugs = {n["slug"] for n in res.json()["data"]}
        self.assertIn("visible", slugs)
        self.assertNotIn("secret", slugs)

    def test_public_detail_by_slug(self):
        home = _page(title="Home", slug="home", url_path="/")
        _page(title="About", slug="about", url_path="/about", parent=home)
        res = self.client.get("/api/v1/sitemap/about/")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["title"], "About")
        self.assertEqual(data["url"], "https://example.com/about")
        self.assertEqual(data["children"], [])

    def test_public_detail_missing_is_404(self):
        res = self.client.get("/api/v1/sitemap/does-not-exist/")
        self.assertEqual(res.status_code, 404)
        self.assertFalse(res.json()["success"])

    def test_search_and_filter_pages(self):
        home = _page(title="Home", slug="home", url_path="/")
        _page(title="About ShikshaLab", slug="about", url_path="/about", parent=home)
        _page(
            title="Python Course",
            slug="courses-python",
            url_path="/courses/python",
            page_type=SitemapEntry.PageType.COURSE,
        )
        res = self.client.get("/api/v1/sitemap/pages/", {"search": "About"})
        self.assertEqual(res.status_code, 200)
        titles = [row["title"] for row in res.json()["data"]]
        self.assertEqual(titles, ["About ShikshaLab"])
        self.assertIn("meta", res.json())

        res = self.client.get("/api/v1/sitemap/pages/", {"page_type": "course"})
        self.assertEqual([row["slug"] for row in res.json()["data"]], ["courses-python"])

    def test_pages_pagination(self):
        for i in range(3):
            _page(title=f"Page {i}", slug=f"page-{i}", url_path=f"/page-{i}")
        res = self.client.get("/api/v1/sitemap/pages/", {"page_size": 2, "page": 1})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["data"]), 2)
        self.assertEqual(res.json()["meta"]["count"], 3)
        self.assertEqual(res.json()["meta"]["total_pages"], 2)

    def test_xml_sitemap_contains_only_public_urls(self):
        _page(title="Home", slug="home", url_path="/", changefreq="daily", priority=Decimal("1.0"))
        _page(title="About", slug="about", url_path="/about")
        _page(title="Draft", slug="draft", url_path="/draft", is_published=False)
        _page(title="Noindex", slug="noindex", url_path="/private", is_indexable=False)

        res = self.client.get("/sitemap.xml")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res["Content-Type"].startswith("application/xml"))
        body = res.content.decode()
        self.assertIn("<urlset", body)
        self.assertIn("<loc>https://example.com/</loc>", body)
        self.assertIn("<loc>https://example.com/about</loc>", body)
        self.assertIn("<lastmod>", body)
        self.assertIn("<changefreq>daily</changefreq>", body)
        self.assertIn("<priority>1.0</priority>", body)
        self.assertNotIn("/draft", body)
        self.assertNotIn("/private", body)

    @override_settings(SITEMAP_MAX_URLS=2)
    def test_xml_sitemap_splits_when_large(self):
        for i in range(3):
            _page(title=f"P{i}", slug=f"p-{i}", url_path=f"/p-{i}")
        res = self.client.get("/sitemap.xml")
        self.assertEqual(res.status_code, 200)
        body = res.content.decode()
        self.assertIn("<sitemapindex", body)
        self.assertIn("/sitemaps/1.xml", body)
        self.assertIn("/sitemaps/2.xml", body)

        chunk = self.client.get("/sitemaps/1.xml")
        self.assertEqual(chunk.status_code, 200)
        self.assertIn("<urlset", chunk.content.decode())
        missing = self.client.get("/sitemaps/9.xml")
        self.assertEqual(missing.status_code, 404)

    def test_legacy_seo_sitemap_hides_unpublished(self):
        _page(title="Live", slug="live", url_path="/live")
        _page(title="Draft", slug="draft", url_path="/draft", is_published=False)
        res = self.client.get("/api/v1/seo/sitemap/")
        self.assertEqual(res.status_code, 200)
        paths = {row["url_path"] for row in res.json()["data"]}
        self.assertIn("/live", paths)
        self.assertNotIn("/draft", paths)

    def test_admin_api_rejects_self_parent(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        admin = User.objects.create_user(
            email="sitemap-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        token = RefreshToken.for_user(admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        page = _page()
        res = self.client.patch(
            f"/api/v1/seo/sitemap/{page.pk}/",
            {"parent": str(page.pk)},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        payload = res.json()
        errors = payload.get("errors") or payload
        self.assertIn("parent", errors)

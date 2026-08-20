"""Tests for blog sections, nested blog detail, and optional SEO fields."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cms.models import BlogPost, BlogSection, Event

User = get_user_model()


class BlogSectionAndSEOAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="blog-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.teacher = User.objects.create_user(
            email="blog-teacher@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        self.post = BlogPost.objects.create(
            title="Published Post",
            slug="published-post",
            content="Original body.",
            is_published=True,
            published_at=timezone.now(),
        )

    def _auth(self, user):
        token = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def _payload(self, response):
        body = response.json()
        if isinstance(body, dict) and "data" in body and "success" in body:
            return body["data"]
        return body

    def test_create_and_list_sections_ordered(self):
        self._auth(self.admin)
        url = f"/api/v1/content/blog-posts/{self.post.pk}/sections/"
        second = self.client.post(
            url,
            {"title": "Second", "description": "Later block.", "order": 2},
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.content)
        first = self.client.post(
            url,
            {"description": "First block has no title.", "order": 1},
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.content)
        self.assertIsNone(first.data["title"])

        listed = self.client.get(url)
        self.assertEqual(listed.status_code, 200)
        titles = [row["title"] for row in listed.data]
        self.assertEqual(titles, [None, "Second"])
        self.assertEqual(listed.data[0]["description"], "First block has no title.")

    def test_auto_increments_order_when_omitted(self):
        self._auth(self.admin)
        url = f"/api/v1/content/blog-posts/{self.post.pk}/sections/"
        first = self.client.post(url, {"description": "A."}, format="json")
        second = self.client.post(url, {"description": "B."}, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data["order"], 0)
        self.assertEqual(second.data["order"], 1)

    def test_patch_and_delete_section(self):
        self._auth(self.admin)
        section = BlogSection.objects.create(
            blog_post=self.post,
            title="Old",
            description="Old copy.",
            order=0,
        )
        patched = self.client.patch(
            f"/api/v1/content/blog-sections/{section.pk}/",
            {"title": "New", "description": "Updated copy."},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.content)
        self.assertEqual(patched.data["title"], "New")
        self.assertEqual(patched.data["description"], "Updated copy.")

        deleted = self.client.delete(f"/api/v1/content/blog-sections/{section.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(BlogSection.objects.filter(pk=section.pk).exists())

    def test_nested_patch_and_delete_section(self):
        self._auth(self.admin)
        section = BlogSection.objects.create(
            blog_post=self.post,
            title="Old nested",
            description="Old nested copy.",
            order=0,
        )
        url = (
            f"/api/v1/content/blog-posts/{self.post.pk}/sections/{section.pk}/"
        )
        patched = self.client.patch(
            url,
            {"title": "New nested", "description": "Updated nested copy."},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.content)
        self.assertEqual(patched.data["title"], "New nested")
        self.assertEqual(patched.data["description"], "Updated nested copy.")

        deleted = self.client.delete(url)
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(BlogSection.objects.filter(pk=section.pk).exists())

    def test_teacher_cannot_create_section(self):
        self._auth(self.teacher)
        res = self.client.post(
            f"/api/v1/content/blog-posts/{self.post.pk}/sections/",
            {"description": "Nope."},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_anonymous_can_list_published_sections(self):
        BlogSection.objects.create(
            blog_post=self.post,
            title=None,
            description="Public copy.",
            order=0,
        )
        res = self.client.get(f"/api/v1/content/blog-posts/{self.post.pk}/sections/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_public_blog_detail_includes_nested_sections(self):
        BlogSection.objects.create(
            blog_post=self.post,
            title="Later",
            description="Second.",
            order=2,
        )
        BlogSection.objects.create(
            blog_post=self.post,
            title="Intro",
            description="First.",
            order=1,
        )
        res = self.client.get(f"/api/v1/cms/blog/{self.post.slug}/")
        self.assertEqual(res.status_code, 200)
        data = self._payload(res)
        self.assertEqual(
            [row["title"] for row in data["sections"]],
            ["Intro", "Later"],
        )

    def test_create_blog_without_seo_or_og_image(self):
        self._auth(self.admin)
        res = self.client.post(
            "/api/v1/cms/blog/",
            {
                "title": "Bare Post",
                "is_published": True,
                "content": "Hello from the body.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertIsNone(data.get("og_image") or None)
        self.assertEqual(data["meta_title"], "Bare Post")
        self.assertEqual(data["og_title"], "Bare Post")
        self.assertTrue(data["meta_description"].startswith("Hello from the body."))
        self.assertTrue(data["og_description"].startswith("Hello from the body."))
        self.assertEqual(len(data["sections"]), 1)
        self.assertIsNone(data["sections"][0]["title"])
        self.assertEqual(data["sections"][0]["description"], "Hello from the body.")
        post = BlogPost.objects.get(pk=data["id"])
        self.assertFalse(post.og_image)
        self.assertEqual(post.meta_title, "")

    def test_nested_sections_on_blog_create(self):
        self._auth(self.admin)
        res = self.client.post(
            "/api/v1/cms/blog/",
            {
                "title": "Sectioned",
                "is_published": True,
                "sections": [
                    {"title": "One", "description": "First section."},
                    {"description": "Untitled second."},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertEqual(len(data["sections"]), 2)
        self.assertEqual(data["sections"][0]["title"], "One")
        self.assertIsNone(data["sections"][1]["title"])

    def test_data_migration_copies_legacy_content(self):
        import importlib.util
        from pathlib import Path

        post = BlogPost.objects.create(
            title="Legacy",
            slug="legacy-post",
            content="Keep this body.",
        )
        self.assertEqual(post.sections.count(), 0)
        path = (
            Path(__file__).resolve().parents[1]
            / "migrations"
            / "0013_blogsection_and_seo_fields.py"
        )
        spec = importlib.util.spec_from_file_location("cms_0013_blogsection", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        from django.apps import apps

        mod.copy_blog_content_to_sections(apps, None)
        section = BlogSection.objects.get(blog_post=post)
        self.assertIsNone(section.title)
        self.assertEqual(section.description, "Keep this body.")
        self.assertEqual(section.order, 0)

    def test_create_event_without_og_image(self):
        self._auth(self.admin)
        res = self.client.post(
            "/api/v1/cms/events/",
            {
                "title": "Open Day",
                "start_datetime": timezone.now().isoformat(),
                "description": "Campus tour and intro session.",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertIsNone(data.get("og_image") or None)
        self.assertEqual(data["meta_title"], "Open Day")
        self.assertEqual(data["og_title"], "Open Day")
        self.assertTrue("Campus tour" in data["meta_description"])
        self.assertTrue("Campus tour" in data["og_description"])
        event = Event.objects.get(pk=data["id"])
        self.assertFalse(event.og_image)
        self.assertEqual(event.meta_title, "")

    def test_section_description_keeps_safe_html_and_strips_scripts(self):
        self._auth(self.admin)
        res = self.client.post(
            f"/api/v1/content/blog-posts/{self.post.pk}/sections/",
            {
                "description": (
                    '<p>Hello <strong>world</strong></p>'
                    '<script>alert(1)</script>'
                    '<img src="https://cdn.example/x.png" alt="demo">'
                ),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertIn("<p>", data["description"])
        self.assertIn("<strong>world</strong>", data["description"])
        self.assertIn("<img", data["description"])
        self.assertNotIn("<script>", data["description"])
        self.assertIsNone(data.get("image"))

    def test_section_image_upload(self):
        self._auth(self.admin)
        from django.core.files.uploadedfile import SimpleUploadedFile

        gif = SimpleUploadedFile(
            "section.gif",
            b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
            content_type="image/gif",
        )
        res = self.client.post(
            f"/api/v1/content/blog-posts/{self.post.pk}/sections/",
            {"description": "<p>With image</p>", "image": gif},
            format="multipart",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertTrue(data.get("image"))
        section = BlogSection.objects.get(pk=data["id"])
        self.assertTrue(section.image)

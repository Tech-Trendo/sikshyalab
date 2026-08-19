"""Course slugs stay stable after title edits, but remain PATCH-able."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.courses.models import Course

User = get_user_model()


class CourseSlugAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="slug-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.course = Course.objects.create(
            title="UI/UX Design",
            slug="uiux-design",
            is_published=True,
            status=Course.Status.PUBLISHED,
            created_by=self.admin,
        )

    def _auth(self):
        token = RefreshToken.for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def _payload(self, response):
        body = response.json()
        if isinstance(body, dict) and "data" in body and "success" in body:
            return body["data"]
        return body

    def test_title_patch_does_not_regenerate_slug(self):
        self._auth()
        res = self.client.patch(
            f"/api/v1/courses/courses/{self.course.slug}/",
            {"title": "Cyber Security"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.course.refresh_from_db()
        self.assertEqual(self.course.title, "Cyber Security")
        self.assertEqual(self.course.slug, "uiux-design")

    def test_slug_can_be_patched_manually(self):
        self._auth()
        res = self.client.patch(
            f"/api/v1/courses/courses/{self.course.slug}/",
            {"slug": "cyber-security"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = self._payload(res)
        self.assertEqual(data["slug"], "cyber-security")
        self.course.refresh_from_db()
        self.assertEqual(self.course.slug, "cyber-security")

        fetched = self.client.get("/api/v1/courses/courses/cyber-security/")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(self._payload(fetched)["title"], "UI/UX Design")

    def test_slug_collision_appends_suffix(self):
        Course.objects.create(
            title="Other",
            slug="cyber-security",
            is_published=True,
            status=Course.Status.PUBLISHED,
        )
        self._auth()
        res = self.client.patch(
            f"/api/v1/courses/courses/{self.course.slug}/",
            {"slug": "cyber-security"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.course.refresh_from_db()
        self.assertEqual(self.course.slug, "cyber-security-1")

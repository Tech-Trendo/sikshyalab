"""Tests for CourseHighlight nested APIs and public course details."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.courses.models import Course, CourseHighlight, CourseInstructor
from apps.teachers.models import Teacher

User = get_user_model()


class CourseHighlightAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="hl-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.teacher = User.objects.create_user(
            email="hl-teacher@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        Teacher.objects.create(user=self.teacher, teacher_id="TCH-HL-0001")
        self.other = User.objects.create_user(
            email="hl-other@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        Teacher.objects.create(user=self.other, teacher_id="TCH-HL-0002")

        self.course = Course.objects.create(
            title="MERN Stack",
            slug="mern-stack",
            is_published=True,
            status=Course.Status.PUBLISHED,
            created_by=self.teacher,
            why_this_course_title="Why MERN Stack?",
        )
        CourseInstructor.objects.get_or_create(
            course=self.course,
            teacher=self.teacher.teacher_profile,
            defaults={"is_primary": True},
        )

    def _auth(self, user):
        token = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def _payload(self, response):
        body = response.json()
        if isinstance(body, dict) and "data" in body and "success" in body:
            return body["data"]
        return body

    def test_create_and_list_highlights_ordered(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/highlights/"
        second = self.client.post(
            url,
            {
                "heading": "Full stack in one language:",
                "description": "JavaScript on both ends.",
                "order": 2,
            },
            format="json",
        )
        self.assertEqual(second.status_code, 201)
        first = self.client.post(
            url,
            {
                "heading": "Industry standard:",
                "description": "Widely used in production.",
                "order": 1,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201)

        listed = self.client.get(url)
        self.assertEqual(listed.status_code, 200)
        headings = [row["heading"] for row in listed.data]
        self.assertEqual(headings, ["Industry standard:", "Full stack in one language:"])

    def test_auto_increments_order_when_omitted(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/highlights/"
        first = self.client.post(
            url,
            {"heading": "One", "description": "First point."},
            format="json",
        )
        second = self.client.post(
            url,
            {"heading": "Two", "description": "Second point."},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data["order"], 0)
        self.assertEqual(second.data["order"], 1)

    def test_patch_and_delete(self):
        self._auth(self.admin)
        point = CourseHighlight.objects.create(
            course=self.course,
            heading="Old heading",
            description="Old copy.",
            order=0,
        )
        patched = self.client.patch(
            f"/api/v1/content/highlights/{point.pk}/",
            {"heading": "New heading"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data["heading"], "New heading")

        deleted = self.client.delete(f"/api/v1/content/highlights/{point.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(CourseHighlight.objects.filter(pk=point.pk).exists())

    def test_other_teacher_cannot_create(self):
        self._auth(self.other)
        res = self.client.post(
            f"/api/v1/content/courses/{self.course.pk}/highlights/",
            {"heading": "Nope", "description": "Not allowed."},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_other_teacher_cannot_patch(self):
        self._auth(self.other)
        point = CourseHighlight.objects.create(
            course=self.course,
            heading="Owned",
            description="By the assigned teacher.",
            order=0,
        )
        res = self.client.patch(
            f"/api/v1/content/highlights/{point.pk}/",
            {"heading": "Hijacked"},
            format="json",
        )
        self.assertIn(res.status_code, (403, 404))

    def test_public_course_details_include_title_and_highlights(self):
        CourseHighlight.objects.create(
            course=self.course,
            heading="Second",
            description="Listed second.",
            order=2,
        )
        CourseHighlight.objects.create(
            course=self.course,
            heading="First",
            description="Listed first.",
            order=1,
        )
        res = self.client.get(f"/api/v1/courses/courses/{self.course.slug}/")
        self.assertEqual(res.status_code, 200)
        data = self._payload(res)
        self.assertEqual(data["why_this_course_title"], "Why MERN Stack?")
        self.assertEqual([row["heading"] for row in data["highlights"]], ["First", "Second"])

    def test_teacher_can_update_why_this_course_title(self):
        self._auth(self.teacher)
        res = self.client.patch(
            f"/api/v1/courses/courses/{self.course.slug}/",
            {"why_this_course_title": "Why this stack?"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.course.refresh_from_db()
        self.assertEqual(self.course.why_this_course_title, "Why this stack?")

    def test_nested_highlights_on_course_patch_are_saved(self):
        self._auth(self.admin)
        res = self.client.patch(
            f"/api/v1/courses/courses/{self.course.slug}/",
            {
                "highlights": [
                    {"heading": "Hands-on labs", "description": "Practice real attacks."},
                    {"title": "Career ready", "text": "Mapped to job skills."},
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = self._payload(res)
        self.assertEqual(len(data["highlights"]), 2)
        self.assertEqual(data["highlights"][0]["heading"], "Hands-on labs")
        self.assertEqual(data["highlights"][1]["heading"], "Career ready")
        self.assertEqual(data["highlights"][1]["description"], "Mapped to job skills.")

        listed = self.client.get(f"/api/v1/courses/courses/{self.course.slug}/")
        public = self._payload(listed)
        self.assertEqual(
            [row["heading"] for row in public["highlights"]],
            ["Hands-on labs", "Career ready"],
        )

    def test_create_highlight_accepts_title_alias(self):
        self._auth(self.teacher)
        res = self.client.post(
            f"/api/v1/content/courses/{self.course.pk}/highlights/",
            {"title": "Alias heading", "text": "Alias body."},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["heading"], "Alias heading")
        self.assertEqual(res.data["description"], "Alias body.")
        self.assertTrue(CourseHighlight.objects.filter(heading="Alias heading").exists())

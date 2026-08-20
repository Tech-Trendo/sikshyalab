"""Course create: optional SEO/og_image and nested highlights + FAQs."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.content.models import CourseFAQ
from apps.courses.models import Course, CourseHighlight

User = get_user_model()


class CourseSEOAndNestedCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="course-seo-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )

    def _auth(self):
        token = RefreshToken.for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def _payload(self, response):
        body = response.json()
        if isinstance(body, dict) and "data" in body and "success" in body:
            return body["data"]
        return body

    def test_create_course_with_only_core_fields(self):
        self._auth()
        res = self.client.post(
            "/api/v1/courses/courses/",
            {
                "title": "Cyber Security",
                "description": "Hands-on defensive and offensive labs.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertEqual(data["title"], "Cyber Security")
        self.assertEqual(data["highlights"], [])
        self.assertEqual(data["faqs"], [])
        self.assertIsNone(data.get("og_image") or None)
        self.assertEqual(data["meta_title"], "Cyber Security")
        self.assertEqual(data["og_title"], "Cyber Security")
        self.assertTrue("Hands-on" in data["meta_description"])
        self.assertTrue("Hands-on" in data["og_description"])
        course = Course.objects.get(pk=data["id"])
        self.assertFalse(course.og_image)
        self.assertEqual(course.meta_title, "")
        self.assertEqual(course.meta_description, "")
        self.assertFalse(CourseHighlight.objects.filter(course=course).exists())
        self.assertFalse(CourseFAQ.objects.filter(course=course).exists())

    def test_create_course_with_nested_highlights_and_faqs(self):
        self._auth()
        res = self.client.post(
            "/api/v1/courses/courses/",
            {
                "title": "QA Engineering",
                "highlights": [
                    {"heading": "Practice", "description": "Real test cases."},
                ],
                "faqs": [
                    {"question": "Is it beginner friendly?", "answer": "Yes."},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertEqual(len(data["highlights"]), 1)
        self.assertEqual(data["highlights"][0]["heading"], "Practice")
        self.assertEqual(len(data["faqs"]), 1)
        self.assertEqual(data["faqs"][0]["question"], "Is it beginner friendly?")
        course = Course.objects.get(pk=data["id"])
        self.assertEqual(CourseHighlight.objects.filter(course=course).count(), 1)
        self.assertEqual(CourseFAQ.objects.filter(course=course).count(), 1)

    def test_patch_nested_faqs_replace_all(self):
        self._auth()
        created = self.client.post(
            "/api/v1/courses/courses/",
            {
                "title": "Business Analyst",
                "faqs": [{"question": "Old?", "answer": "Old."}],
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        slug = self._payload(created)["slug"]
        patched = self.client.patch(
            f"/api/v1/courses/courses/{slug}/",
            {
                "faqs": [
                    {"question": "New Q?", "answer": "New A."},
                    {"question": "Another?", "answer": "Yep."},
                ]
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.content)
        data = self._payload(patched)
        self.assertEqual(
            [row["question"] for row in data["faqs"]],
            ["New Q?", "Another?"],
        )

    def test_course_description_keeps_safe_html_and_strips_scripts(self):
        self._auth()
        res = self.client.post(
            "/api/v1/courses/courses/",
            {
                "title": "Rich Text Course",
                "description": (
                    "<h2>Overview</h2><p>Learn <em>fast</em>.</p>"
                    "<script>alert(1)</script>"
                ),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = self._payload(res)
        self.assertIn("<h2>Overview</h2>", data["description"])
        self.assertIn("<em>fast</em>", data["description"])
        self.assertNotIn("<script>", data["description"])
        self.assertTrue("Overview" in data["meta_description"])
        self.assertNotIn("<h2>", data["meta_description"])

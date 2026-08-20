"""Tests for course-specific FAQ APIs in the content app."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.content.models import CourseFAQ
from apps.courses.models import Course, CourseInstructor
from apps.teachers.models import Teacher

User = get_user_model()


class CourseFAQAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="faq-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.teacher = User.objects.create_user(
            email="faq-teacher@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        Teacher.objects.create(user=self.teacher, teacher_id="TCH-FAQ-0001")
        self.other = User.objects.create_user(
            email="faq-other@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        Teacher.objects.create(user=self.other, teacher_id="TCH-FAQ-0002")

        self.course = Course.objects.create(
            title="FAQ Course",
            slug="faq-course",
            is_published=True,
            status=Course.Status.PUBLISHED,
            created_by=self.teacher,
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

    def test_create_and_list_faqs_ordered(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/faqs/"
        second = self.client.post(
            url,
            {
                "question": "How long is the course?",
                "answer": "Twelve weeks.",
                "order": 2,
            },
            format="json",
        )
        self.assertEqual(second.status_code, 201)
        first = self.client.post(
            url,
            {
                "question": "Do I need prior experience?",
                "answer": "No prior experience required.",
                "order": 1,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201)

        listed = self.client.get(url)
        self.assertEqual(listed.status_code, 200)
        questions = [row["question"] for row in listed.data]
        self.assertEqual(
            questions,
            ["Do I need prior experience?", "How long is the course?"],
        )

    def test_auto_increments_order_when_omitted(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/faqs/"
        first = self.client.post(
            url,
            {"question": "Q1?", "answer": "A1."},
            format="json",
        )
        second = self.client.post(
            url,
            {"question": "Q2?", "answer": "A2."},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data["order"], 0)
        self.assertEqual(second.data["order"], 1)

    def test_patch_and_delete(self):
        self._auth(self.admin)
        faq = CourseFAQ.objects.create(
            course=self.course,
            question="Old?",
            answer="Old answer.",
            order=0,
        )
        patched = self.client.patch(
            f"/api/v1/content/course-faqs/{faq.pk}/",
            {"question": "New?"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data["question"], "New?")

        deleted = self.client.delete(f"/api/v1/content/course-faqs/{faq.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(CourseFAQ.objects.filter(pk=faq.pk).exists())

    def test_other_teacher_cannot_create(self):
        self._auth(self.other)
        res = self.client.post(
            f"/api/v1/content/courses/{self.course.pk}/faqs/",
            {"question": "Nope?", "answer": "Not allowed."},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_other_teacher_cannot_patch(self):
        self._auth(self.other)
        faq = CourseFAQ.objects.create(
            course=self.course,
            question="Owned?",
            answer="By assigned teacher.",
            order=0,
        )
        res = self.client.patch(
            f"/api/v1/content/course-faqs/{faq.pk}/",
            {"question": "Hijacked?"},
            format="json",
        )
        self.assertIn(res.status_code, (403, 404))

    def test_public_course_details_include_faqs(self):
        CourseFAQ.objects.create(
            course=self.course,
            question="Second?",
            answer="Second answer.",
            order=2,
        )
        CourseFAQ.objects.create(
            course=self.course,
            question="First?",
            answer="First answer.",
            order=1,
        )
        res = self.client.get(f"/api/v1/courses/courses/{self.course.slug}/")
        self.assertEqual(res.status_code, 200)
        data = self._payload(res)
        self.assertEqual([row["question"] for row in data["faqs"]], ["First?", "Second?"])

    def test_public_can_list_course_faqs(self):
        CourseFAQ.objects.create(
            course=self.course,
            question="Visible?",
            answer="Yes.",
            order=0,
        )
        res = self.client.get(f"/api/v1/content/courses/{self.course.pk}/faqs/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["question"], "Visible?")

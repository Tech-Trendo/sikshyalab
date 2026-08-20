"""Tests for Chapter → Part → Topic curriculum APIs."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.content.models import Chapter, Part, Topic
from apps.courses.models import Course, CourseInstructor
from apps.teachers.models import Teacher

User = get_user_model()


class TopicAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="topic-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.teacher = User.objects.create_user(
            email="topic-teacher@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
            first_name="Tea",
            last_name="Cher",
        )
        Teacher.objects.create(user=self.teacher, teacher_id="TCH-TOPIC-0001")
        self.other_teacher = User.objects.create_user(
            email="topic-other@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        Teacher.objects.create(user=self.other_teacher, teacher_id="TCH-TOPIC-0002")

        self.course = Course.objects.create(
            title="Topic Course",
            slug="topic-course",
            is_published=True,
            status=Course.Status.PUBLISHED,
            created_by=self.teacher,
        )
        CourseInstructor.objects.get_or_create(
            course=self.course,
            teacher=self.teacher.teacher_profile,
            defaults={"is_primary": True},
        )
        self.chapter = Chapter.objects.create(
            course=self.course,
            title="Chapter 1",
            slug="chapter-1",
            order=1,
            is_published=True,
        )
        self.part = Part.objects.create(
            chapter=self.chapter,
            title="Part 1",
            slug="part-1",
            order=1,
            is_published=True,
        )

    def _auth(self, user):
        token = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def test_create_and_list_topics_nested_under_part(self):
        self._auth(self.teacher)
        res = self.client.post(
            f"/api/v1/content/parts/{self.part.pk}/topics/",
            {"title": "Variables", "order": 2},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["title"], "Variables")
        self.assertEqual(res.data["part"], self.part.pk)

        self.client.post(
            f"/api/v1/content/parts/{self.part.pk}/topics/",
            {"title": "Intro", "order": 1},
            format="json",
        )
        listed = self.client.get(f"/api/v1/content/parts/{self.part.pk}/topics/")
        self.assertEqual(listed.status_code, 200)
        titles = [row["title"] for row in listed.data]
        self.assertEqual(titles, ["Intro", "Variables"])

    def test_patch_and_delete_topic(self):
        self._auth(self.admin)
        topic = Topic.objects.create(part=self.part, title="Old", order=0)
        patched = self.client.patch(
            f"/api/v1/content/topics/{topic.pk}/",
            {"title": "New title"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data["title"], "New title")

        deleted = self.client.delete(f"/api/v1/content/topics/{topic.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Topic.objects.filter(pk=topic.pk).exists())

    def test_other_teacher_cannot_create_topic(self):
        self._auth(self.other_teacher)
        res = self.client.post(
            f"/api/v1/content/parts/{self.part.pk}/topics/",
            {"title": "Nope"},
            format="json",
        )
        self.assertIn(res.status_code, (403, 404))

    def test_public_curriculum_nests_topics_in_order(self):
        Topic.objects.create(part=self.part, title="Second", order=2)
        Topic.objects.create(part=self.part, title="First", order=1)
        res = self.client.get(f"/api/v1/courses/courses/{self.course.slug}/curriculum/")
        self.assertEqual(res.status_code, 200)
        payload = res.json()["data"]
        self.assertEqual(len(payload), 1)
        topics = payload[0]["parts"][0]["topics"]
        self.assertEqual([t["title"] for t in topics], ["First", "Second"])

"""Tests for upcoming ClassSchedule APIs."""

from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.content.models import ClassSchedule
from apps.courses.models import Course, CourseInstructor
from apps.teachers.models import Teacher

User = get_user_model()


class ClassScheduleAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="sched-admin@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.teacher = User.objects.create_user(
            email="sched-teacher@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        Teacher.objects.create(user=self.teacher, teacher_id="TCH-SCHED-0001")
        self.other = User.objects.create_user(
            email="sched-other@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
        )
        Teacher.objects.create(user=self.other, teacher_id="TCH-SCHED-0002")

        self.course = Course.objects.create(
            title="Schedule Course",
            slug="schedule-course",
            is_published=True,
            status=Course.Status.PUBLISHED,
            created_by=self.teacher,
        )
        CourseInstructor.objects.get_or_create(
            course=self.course,
            teacher=self.teacher.teacher_profile,
            defaults={"is_primary": True},
        )
        self.soon = timezone.localdate() + timedelta(days=14)
        self.past = timezone.localdate() - timedelta(days=2)

    def _auth(self, user):
        token = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def test_create_two_slots_same_date_and_group_list(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/class-schedules/"
        morning = self.client.post(
            url,
            {
                "date": self.soon.isoformat(),
                "start_time": "09:00:00",
                "end_time": "11:00:00",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(morning.status_code, 201)
        afternoon = self.client.post(
            url,
            {
                "date": self.soon.isoformat(),
                "start_time": "14:00:00",
                "end_time": "16:00:00",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(afternoon.status_code, 201)

        listed = self.client.get(url)
        self.assertEqual(listed.status_code, 200)
        groups = listed.data
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["date"], self.soon.isoformat())
        self.assertEqual(len(groups[0]["slots"]), 2)
        self.assertEqual(groups[0]["slots"][0]["start_time"], "09:00:00")
        self.assertEqual(groups[0]["slots"][1]["start_time"], "14:00:00")

    def test_create_two_slots_same_date_using_start_datetime_alias(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/class-schedules/"
        soon_date = self.soon

        morning = self.client.post(
            url,
            {
                "start_datetime": f"{soon_date.isoformat()}T09:00:00",
                "end_datetime": f"{soon_date.isoformat()}T11:00:00",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(morning.status_code, 201)

        afternoon = self.client.post(
            url,
            {
                "start_datetime": f"{soon_date.isoformat()}T14:00:00",
                "end_datetime": f"{soon_date.isoformat()}T16:00:00",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(afternoon.status_code, 201)

        listed = self.client.get(url)
        self.assertEqual(listed.status_code, 200)
        groups = listed.data
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["date"], soon_date.isoformat())
        self.assertEqual(len(groups[0]["slots"]), 2)
        self.assertEqual(groups[0]["slots"][0]["start_time"], "09:00:00")
        self.assertEqual(groups[0]["slots"][1]["start_time"], "14:00:00")

    def test_create_rejects_end_datetime_before_start_datetime(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/class-schedules/"
        bad = self.client.post(
            url,
            {
                "start_datetime": f"{self.soon.isoformat()}T11:00:00",
                "end_datetime": f"{self.soon.isoformat()}T10:00:00",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        body = bad.json()
        self.assertIn("errors", body)
        self.assertIn("end_time", body["errors"])

    def test_create_defaults_is_published_true_and_appears_publicly(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/class-schedules/"
        created = self.client.post(
            url,
            {
                "date": self.soon.isoformat(),
                "start_time": "09:00:00",
                "end_time": "11:00:00",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertTrue(created.data["is_published"])

        self.client.credentials()
        public = self.client.get(f"/api/v1/courses/courses/{self.course.slug}/class-schedules/")
        self.assertEqual(public.status_code, 200)
        data = public.json()["data"]
        self.assertEqual(len(data), 1)
        self.assertEqual(len(data[0]["slots"]), 1)
        self.assertEqual(data[0]["slots"][0]["start_time"], "09:00:00")
        self.assertTrue(data[0]["slots"][0]["is_published"])

    def test_list_excludes_past_and_unpublished_for_public(self):
        ClassSchedule.objects.create(
            course=self.course,
            date=self.past,
            start_time=time(9, 0),
            end_time=time(11, 0),
            is_published=True,
        )
        ClassSchedule.objects.create(
            course=self.course,
            date=self.soon,
            start_time=time(9, 0),
            end_time=time(11, 0),
            is_published=False,
        )
        ClassSchedule.objects.create(
            course=self.course,
            date=self.soon,
            start_time=time(14, 0),
            end_time=time(16, 0),
            is_published=True,
        )
        res = self.client.get(f"/api/v1/courses/courses/{self.course.slug}/class-schedules/")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(len(data), 1)
        self.assertEqual(len(data[0]["slots"]), 1)
        self.assertEqual(data[0]["slots"][0]["start_time"], "14:00:00")

    def test_patch_and_delete(self):
        self._auth(self.admin)
        slot = ClassSchedule.objects.create(
            course=self.course,
            date=self.soon,
            start_time=time(9, 0),
            end_time=time(11, 0),
            is_published=True,
        )
        patched = self.client.patch(
            f"/api/v1/content/class-schedules/{slot.pk}/",
            {"end_time": "12:00:00"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(str(patched.data["end_time"]), "12:00:00")
        deleted = self.client.delete(f"/api/v1/content/class-schedules/{slot.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(ClassSchedule.objects.filter(pk=slot.pk).exists())

    def test_teacher_can_partial_patch_each_field(self):
        self._auth(self.teacher)
        later = self.soon + timedelta(days=1)
        slot = ClassSchedule.objects.create(
            course=self.course,
            date=self.soon,
            start_time=time(9, 0),
            end_time=time(11, 0),
            is_published=True,
        )
        url = f"/api/v1/content/class-schedules/{slot.pk}/"

        date_only = self.client.patch(url, {"date": later.isoformat()}, format="json")
        self.assertEqual(date_only.status_code, 200, date_only.content)
        self.assertEqual(date_only.data["date"], later.isoformat())
        self.assertEqual(str(date_only.data["start_time"]), "09:00:00")
        self.assertEqual(str(date_only.data["end_time"]), "11:00:00")

        start_only = self.client.patch(url, {"start_time": "08:30:00"}, format="json")
        self.assertEqual(start_only.status_code, 200, start_only.content)
        self.assertEqual(str(start_only.data["start_time"]), "08:30:00")
        self.assertEqual(start_only.data["date"], later.isoformat())

        end_only = self.client.patch(url, {"end_time": "12:15:00"}, format="json")
        self.assertEqual(end_only.status_code, 200, end_only.content)
        self.assertEqual(str(end_only.data["end_time"]), "12:15:00")
        self.assertEqual(str(end_only.data["start_time"]), "08:30:00")

        unpublish = self.client.patch(url, {"is_published": False}, format="json")
        self.assertEqual(unpublish.status_code, 200, unpublish.content)
        self.assertFalse(unpublish.data["is_published"])
        self.assertEqual(str(unpublish.data["end_time"]), "12:15:00")

        slot.refresh_from_db()
        self.assertEqual(slot.date, later)
        self.assertEqual(slot.start_time, time(8, 30))
        self.assertEqual(slot.end_time, time(12, 15))
        self.assertFalse(slot.is_published)

    def test_teacher_can_delete_schedule(self):
        self._auth(self.teacher)
        slot = ClassSchedule.objects.create(
            course=self.course,
            date=self.soon,
            start_time=time(9, 0),
            end_time=time(11, 0),
        )
        deleted = self.client.delete(f"/api/v1/content/class-schedules/{slot.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(ClassSchedule.objects.filter(pk=slot.pk).exists())

    def test_other_teacher_cannot_patch_or_delete(self):
        slot = ClassSchedule.objects.create(
            course=self.course,
            date=self.soon,
            start_time=time(9, 0),
            end_time=time(11, 0),
        )
        self._auth(self.other)
        patched = self.client.patch(
            f"/api/v1/content/class-schedules/{slot.pk}/",
            {"end_time": "12:00:00"},
            format="json",
        )
        self.assertIn(patched.status_code, (403, 404))
        deleted = self.client.delete(f"/api/v1/content/class-schedules/{slot.pk}/")
        self.assertIn(deleted.status_code, (403, 404))
        self.assertTrue(ClassSchedule.objects.filter(pk=slot.pk).exists())

    def test_other_teacher_cannot_create(self):
        self._auth(self.other)
        res = self.client.post(
            f"/api/v1/content/courses/{self.course.pk}/class-schedules/",
            {
                "date": self.soon.isoformat(),
                "start_time": "09:00:00",
                "end_time": "11:00:00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_overlap_rejected(self):
        self._auth(self.teacher)
        url = f"/api/v1/content/courses/{self.course.pk}/class-schedules/"
        first = self.client.post(
            url,
            {
                "date": self.soon.isoformat(),
                "start_time": "09:00:00",
                "end_time": "11:00:00",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        overlap = self.client.post(
            url,
            {
                "date": self.soon.isoformat(),
                "start_time": "10:00:00",
                "end_time": "12:00:00",
            },
            format="json",
        )
        self.assertEqual(overlap.status_code, 400)

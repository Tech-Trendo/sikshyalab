"""Assignment submission file persistence and authorized media access."""

from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlparse

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.assignments.models import Assignment, AssignmentAllocation, Submission
from apps.courses.models import Course
from apps.students.models import Student
from apps.teachers.models import Teacher

User = get_user_model()


def _payload(response):
    body = response.json()
    if isinstance(body, dict) and "data" in body and "success" in body:
        return body["data"]
    return body


def _pdf(name="lab-report.pdf", content=b"%PDF-1.4 test-bytes"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


class AssignmentSubmissionFileTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.course = Course.objects.create(
            title="Python Foundations",
            slug="python-foundations-asg",
            price=Decimal("10000.00"),
            status=Course.Status.PUBLISHED,
            is_published=True,
        )
        self.teacher_user = User.objects.create_user(
            email="asg-teacher@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.TEACHER,
            first_name="Tea",
            last_name="Cher",
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user, teacher_id="TCH-ASG-0001"
        )
        self.student_user = User.objects.create_user(
            email="asg-student@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.STUDENT,
            first_name="Stu",
            last_name="Dent",
        )
        self.student = Student.objects.create(
            user=self.student_user, student_id="STU-ASG-0001"
        )
        self.other_user = User.objects.create_user(
            email="asg-other@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.STUDENT,
            first_name="Oth",
            last_name="Er",
        )
        self.other = Student.objects.create(
            user=self.other_user, student_id="STU-ASG-0002"
        )
        self.assignment = Assignment.objects.create(
            title="Week 1 Lab",
            description="Submit a PDF",
            course=self.course,
            teacher=self.teacher,
            due_date=timezone.now() + timedelta(days=7),
            max_marks=Decimal("100.00"),
            status=Assignment.Status.PUBLISHED,
        )
        AssignmentAllocation.objects.create(
            assignment=self.assignment, student=self.student
        )

    def _auth(self, user):
        token = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        return self.client

    def _submit(self, user, **extra):
        self._auth(user)
        payload = {"assignment": str(self.assignment.pk), **extra}
        return self.client.post(
            "/api/v1/assignments/submissions/",
            payload,
            format="multipart",
        )

    def test_student_submit_persists_file_and_returns_it(self):
        res = self._submit(
            self.student_user,
            content="Please see attached.",
            attachment=_pdf(),
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        data = _payload(res)
        self.assertEqual(data["student"], str(self.student.pk))
        self.assertEqual(data["assignment"], str(self.assignment.pk))
        self.assertIsNotNone(data["submitted_file"])
        self.assertTrue(data["submitted_file"]["name"].endswith(".pdf"))
        self.assertIn("/media/", data["submitted_file"]["url"])
        self.assertIn("assignments/submissions/", data["submitted_file"]["url"])
        self.assertIn("/media/", data["attachment"])
        self.assertTrue(data["submitted_at"])
        self.assertTrue(urlparse(data["submitted_file"]["url"]).netloc)

        submission = Submission.objects.get(pk=data["id"])
        self.assertTrue(submission.attachment)
        self.assertTrue(submission.attachment.name.startswith("assignments/submissions/"))

    def test_file_alias_is_accepted(self):
        res = self._submit(self.student_user, file=_pdf("alias.pdf"))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        data = _payload(res)
        self.assertIn("alias", data["submitted_file"]["name"])

    def test_student_retrieve_and_mine_include_file(self):
        created = _payload(self._submit(self.student_user, attachment=_pdf("first.pdf")))
        listed = self.client.get(
            f"/api/v1/assignments/submissions/?assignment={self.assignment.pk}"
        )
        self.assertEqual(listed.status_code, 200)
        rows = _payload(listed)
        self.assertTrue(any(row["id"] == created["id"] and row["submitted_file"] for row in rows))

        mine = self.client.get(
            f"/api/v1/assignments/submissions/mine/?assignment={self.assignment.pk}"
        )
        self.assertEqual(mine.status_code, 200)
        mine_data = _payload(mine)
        self.assertEqual(mine_data["id"], created["id"])
        self.assertTrue(mine_data["submitted_file"]["url"])

        detail = self.client.get(f"/api/v1/assignments/submissions/{created['id']}/")
        self.assertEqual(detail.status_code, 200)
        self.assertTrue(_payload(detail)["submitted_file"]["url"])

    def test_teacher_list_and_nested_include_file(self):
        created = _payload(
            self._submit(self.student_user, attachment=_pdf("for-teacher.pdf"))
        )
        self._auth(self.teacher_user)
        listed = self.client.get(
            f"/api/v1/assignments/submissions/?assignment={self.assignment.pk}"
        )
        self.assertEqual(listed.status_code, 200)
        match = next(row for row in _payload(listed) if row["id"] == created["id"])
        self.assertTrue(match["submitted_file"]["url"])
        self.assertTrue(match["attachment"])

        nested = self.client.get(
            f"/api/v1/assignments/assignments/{self.assignment.pk}/submissions/"
        )
        self.assertEqual(nested.status_code, 200)
        nested_match = next(
            row for row in _payload(nested) if row["id"] == created["id"]
        )
        self.assertTrue(nested_match["submitted_file"]["name"])

        detail = self.client.get(f"/api/v1/assignments/submissions/{created['id']}/")
        self.assertEqual(detail.status_code, 200)
        self.assertTrue(_payload(detail)["submitted_file"]["url"])

    def test_authorized_users_can_download_file_others_cannot(self):
        created = _payload(self._submit(self.student_user, attachment=_pdf()))
        media_path = urlparse(created["submitted_file"]["url"]).path

        own = self.client.get(media_path)
        self.assertEqual(own.status_code, 200)
        body = b"".join(own.streaming_content)
        self.assertTrue(body.startswith(b"%PDF"))

        self._auth(self.teacher_user)
        teacher_get = self.client.get(media_path)
        self.assertEqual(teacher_get.status_code, 200)

        self._auth(self.other_user)
        denied = self.client.get(media_path)
        self.assertEqual(denied.status_code, 403)

        anon = APIClient()
        anon_denied = anon.get(media_path)
        self.assertEqual(anon_denied.status_code, 403)

    def test_submission_download_endpoint(self):
        created = _payload(self._submit(self.student_user, attachment=_pdf("report.pdf")))
        sub_id = created["id"]

        res = self.client.get(f"/api/v1/assignments/submissions/{sub_id}/download/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("attachment", res["Content-Disposition"])
        body = b"".join(res.streaming_content)
        self.assertTrue(body.startswith(b"%PDF"))

        self._auth(self.teacher_user)
        teacher_res = self.client.get(f"/api/v1/assignments/submissions/{sub_id}/download/")
        self.assertEqual(teacher_res.status_code, 200)

        self._auth(self.other_user)
        denied = self.client.get(f"/api/v1/assignments/submissions/{sub_id}/download/")
        self.assertEqual(denied.status_code, 404)

    def test_submission_download_without_file_returns_404(self):
        res = self._submit(self.student_user, content="Text only")
        sub_id = _payload(res)["id"]
        download = self.client.get(f"/api/v1/assignments/submissions/{sub_id}/download/")
        self.assertEqual(download.status_code, 404)

    def test_resubmit_returns_latest_file(self):
        first = _payload(
            self._submit(
                self.student_user,
                attachment=_pdf("v1.pdf", b"%PDF-1.4 first"),
            )
        )
        second = _payload(
            self._submit(
                self.student_user,
                attachment=_pdf("v2.pdf", b"%PDF-1.4 second"),
            )
        )
        self.assertNotEqual(second["id"], first["id"])
        self.assertEqual(second["attempt_number"], 2)
        self.assertIn("v2", second["submitted_file"]["name"])

        mine = _payload(
            self.client.get(
                f"/api/v1/assignments/submissions/mine/?assignment={self.assignment.pk}"
            )
        )
        self.assertEqual(mine["id"], second["id"])
        self.assertIn("v2", mine["submitted_file"]["name"])

        first_row = Submission.objects.get(pk=first["id"])
        second_row = Submission.objects.get(pk=second["id"])
        self.assertNotEqual(first_row.attachment.name, second_row.attachment.name)

    def test_submission_without_file_is_allowed(self):
        res = self._submit(self.student_user, content="Text only")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        data = _payload(res)
        self.assertIsNone(data["submitted_file"])
        self.assertTrue(data["attachment"] in (None, ""))
        self.assertEqual(data["content"], "Text only")

    def test_invalid_file_type_is_rejected(self):
        res = self._submit(
            self.student_user,
            attachment=SimpleUploadedFile(
                "malware.exe", b"MZ", content_type="application/octet-stream"
            ),
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        errors = res.json().get("errors") or {}
        self.assertIn("attachment", errors)

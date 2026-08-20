"""Tests for PDF export (table reports + student/teacher entity exports)."""

from __future__ import annotations

import re

import pytest
from django.contrib.auth import get_user_model

from apps.common.pdf_export import build_table_pdf
from apps.students.models import Student
from apps.teachers.models import Teacher

User = get_user_model()

PDF_URL = "/api/v1/exports/pdf/"
PUBLIC_URL = "/api/v1/exports/pdf/public/"


def _pdf_text(pdf_bytes: bytes) -> str:
    return pdf_bytes.decode("latin-1", errors="replace")


def _assert_valid_pdf(response, *, must_contain: str | None = None) -> bytes:
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert "attachment" in response["Content-Disposition"]
    content = response.content
    assert content.startswith(b"%PDF")
    assert b"%%EOF" in content
    if must_contain:
        assert must_contain in _pdf_text(content)
    return content


@pytest.mark.django_db
class TestBuildTablePdf:
    def test_multiple_rows_embed_text(self):
        pdf = build_table_pdf(
            "Students report",
            ["ID", "Name", "Email"],
            [
                ["STU-1", "John Doe", "john@example.com"],
                ["STU-2", "Jane Smith", "jane@example.com"],
            ],
        )
        text = _pdf_text(pdf)
        assert "John Doe" in text
        assert "Jane Smith" in text

    def test_single_row(self):
        pdf = build_table_pdf("Teachers report", ["Name"], [["Alice O'Brien"]])
        assert "Alice O'Brien" in _pdf_text(pdf)

    def test_empty_shows_message(self):
        pdf = build_table_pdf(
            "Students report",
            ["Student ID", "Name"],
            [],
            empty_message="No students found",
        )
        assert "No students found" in _pdf_text(pdf)

    def test_pagination_for_large_dataset(self):
        rows = [[f"STU-{i}", f"Student {i}"] for i in range(30)]
        pdf = build_table_pdf("Students report", ["ID", "Name"], rows)
        text = _pdf_text(pdf)
        assert "Page 1 of 2" in text
        assert "Page 2 of 2" in text
        assert "Student 0" in text
        assert "Student 29" in text

    def test_empty_with_full_student_headers(self):
        headers = [
            "Student ID",
            "Name",
            "Email",
            "Phone",
            "Course",
            "Batch",
            "Status",
            "Admission date",
            "Registered",
        ]
        pdf = build_table_pdf(
            "Students report",
            headers,
            [],
            empty_message="No students found",
        )
        assert "No students found" in _pdf_text(pdf)

    def test_export_data_empty_students_chain(self, admin_user):
        Student.objects.all().delete()
        from apps.common.export_data import build_students_export

        title, headers, rows, empty_message = build_students_export(admin_user)
        assert rows == []
        assert empty_message == "No students found"
        pdf = build_table_pdf(title, headers, rows, empty_message=empty_message)
        assert "No students found" in _pdf_text(pdf)

    def test_xref_object_numbers_are_sequential(self):
        pdf = build_table_pdf("Report", ["A"], [["1"]])
        text = _pdf_text(pdf)
        assert re.search(r"3 0 obj<< /Type /Font", text)
        assert re.search(r"4 0 obj<< /Type /Font", text)
        assert re.search(r"5 0 obj<< /Type /Page", text)
        assert re.search(r"6 0 obj<< /Length", text)


@pytest.mark.django_db
class TestPdfExportApi:
    def test_public_export_with_client_rows(self, api_client):
        response = api_client.post(
            PUBLIC_URL,
            {
                "title": "Teachers report",
                "headers": ["Name", "Role"],
                "rows": [["Ram Bahadur", "Instructor"]],
            },
            format="json",
        )
        _assert_valid_pdf(response, must_contain="Ram Bahadur")

    def test_public_export_empty_rows(self, api_client):
        response = api_client.post(
            PUBLIC_URL,
            {"title": "Students report", "headers": ["Name"], "rows": []},
            format="json",
        )
        assert response.status_code == 200
        assert response["Content-Type"] == "application/pdf"

    def test_students_entity_export_multiple(self, auth_client, admin_user):
        for i in range(3):
            user = User.objects.create_user(
                email=f"student{i}@test.shikshalab.io",
                password="TestPass123!",
                role=User.Role.STUDENT,
                first_name=f"Student{i}",
                last_name="Test",
            )
            Student.objects.create(user=user, student_id=f"STU-EXP-{i}")

        response = auth_client.post(PDF_URL, {"entity": "students"}, format="json")
        content = _assert_valid_pdf(response, must_contain="STU-EXP-0")
        assert "STU-EXP-1" in _pdf_text(content)
        assert "Student0 Test" in _pdf_text(content)

    def test_students_entity_export_one(self, auth_client):
        user = User.objects.create_user(
            email="solo@test.shikshalab.io",
            password="TestPass123!",
            role=User.Role.STUDENT,
            first_name="Solo",
            last_name="Learner",
        )
        Student.objects.create(user=user, student_id="STU-SOLO")

        response = auth_client.post(PDF_URL, {"entity": "students"}, format="json")
        _assert_valid_pdf(response, must_contain="Solo Learner")

    def test_students_entity_export_empty(self, auth_client, admin_user):
        Student.objects.all().delete()
        assert Student.objects.count() == 0

        response = auth_client.post(PDF_URL, {"entity": "students"}, format="json")
        _assert_valid_pdf(response, must_contain="No students found")

    def test_teachers_entity_export_multiple(self, auth_client):
        for i in range(2):
            user = User.objects.create_user(
                email=f"teacher{i}@test.shikshalab.io",
                password="TestPass123!",
                role=User.Role.TEACHER,
                first_name=f"Teacher{i}",
                last_name="Pro",
            )
            Teacher.objects.create(
                user=user,
                teacher_id=f"TCH-EXP-{i}",
                department="Engineering",
            )

        response = auth_client.post(PDF_URL, {"entity": "teachers"}, format="json")
        content = _assert_valid_pdf(response, must_contain="TCH-EXP-0")
        assert "Teacher0 Pro" in _pdf_text(content)
        assert "Engineering" in _pdf_text(content)

    def test_teachers_entity_export_one(self, auth_client, teacher_user):
        response = auth_client.post(PDF_URL, {"entity": "teachers"}, format="json")
        _assert_valid_pdf(response, must_contain="TCH-TEST-0001")

    def test_teachers_entity_export_empty(self, auth_client):
        Teacher.objects.all().delete()
        response = auth_client.post(PDF_URL, {"entity": "teachers"}, format="json")
        _assert_valid_pdf(response, must_contain="No teachers found")

    def test_special_characters_in_names(self, api_client):
        response = api_client.post(
            PUBLIC_URL,
            {
                "title": "Students report",
                "headers": ["Name"],
                "rows": [["José García-López (Nepal)"]],
            },
            format="json",
        )
        _assert_valid_pdf(response, must_contain="Jos")

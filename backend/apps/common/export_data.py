"""Build tabular export payloads from live DB records."""

from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, ROLE_TEACHER, user_has_role
from apps.courses.models import CourseInstructor
from apps.enrollments.models import Enrollment
from apps.students.models import Student
from apps.teachers.models import Teacher

User = get_user_model()

_ACTIVE_ENROLLMENT = (
    Enrollment.Status.PENDING,
    Enrollment.Status.APPROVED,
    Enrollment.Status.ACTIVE,
    Enrollment.Status.SUSPENDED,
)


def _fmt_date(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)


def _student_queryset_for_user(user):
    qs = Student.objects.select_related("user").order_by("student_id")
    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        return qs
    if user_has_role(user, ROLE_TEACHER):
        return qs.filter(batch_memberships__batch__teacher__user=user).distinct()
    if user_has_role(user, ROLE_STUDENT):
        return qs.filter(user=user)
    return qs.none()


def build_students_export(user) -> tuple[str, list[str], list[list[str]], str | None]:
    """Return (title, headers, rows, empty_message) for student PDF export."""
    qs = _student_queryset_for_user(user)
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
    rows: list[list[str]] = []
    for student in qs.iterator():
        user_obj = student.user
        name = user_obj.get_full_name() if user_obj else ""
        email = getattr(user_obj, "email", "") or ""
        phone = getattr(user_obj, "phone", "") or ""

        enrollment = (
            student.enrollments.select_related("course", "batch")
            .filter(status__in=_ACTIVE_ENROLLMENT)
            .order_by("-created_at")
            .first()
        )
        course_title = enrollment.course.title if enrollment and enrollment.course else ""
        batch_label = ""
        if enrollment and enrollment.batch:
            batch_label = enrollment.batch.code or enrollment.batch.name or str(enrollment.batch_id)

        rows.append(
            [
                student.student_id or str(student.pk),
                name,
                email,
                phone,
                course_title,
                batch_label,
                student.get_status_display() if hasattr(student, "get_status_display") else str(student.status),
                _fmt_date(student.admission_date),
                _fmt_date(student.created_at),
            ]
        )

    empty_message = "No students found" if not rows else None
    return "Students report", headers, rows, empty_message


def build_teachers_export(user) -> tuple[str, list[str], list[list[str]], str | None]:
    """Return (title, headers, rows, empty_message) for teacher PDF export."""
    if not user_has_role(user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER):
        return "Teachers report", [], [], "No teachers found"

    qs = Teacher.objects.select_related("user").order_by("teacher_id")
    headers = [
        "Teacher ID",
        "Name",
        "Email",
        "Phone",
        "Department",
        "Designation",
        "Status",
        "Joining date",
        "Courses",
    ]
    rows: list[list[str]] = []
    for teacher in qs.iterator():
        user_obj = teacher.user
        name = user_obj.get_full_name() if user_obj else ""
        course_count = CourseInstructor.objects.filter(teacher=teacher).count()
        rows.append(
            [
                teacher.teacher_id or str(teacher.pk),
                name,
                getattr(user_obj, "email", "") or "",
                getattr(user_obj, "phone", "") or "",
                teacher.department or "",
                teacher.designation or "",
                teacher.get_status_display() if hasattr(teacher, "get_status_display") else str(teacher.status),
                _fmt_date(teacher.joining_date),
                str(course_count),
            ]
        )

    empty_message = "No teachers found" if not rows else None
    return "Teachers report", headers, rows, empty_message


def resolve_export_table(user, data: dict) -> tuple[str, list[str], list, str | None]:
    """
    Resolve title/headers/rows for PDF export.

    When ``entity`` is ``students`` or ``teachers``, rows are loaded from the DB
    (respecting role-scoped querysets). Otherwise client-supplied rows are used.
    """
    entity = str(data.get("entity") or data.get("export_type") or "").strip().lower()
    subtitle = data.get("subtitle")

    if entity in ("student", "students"):
        title, headers, rows, empty_message = build_students_export(user)
        return title, headers, rows, empty_message

    if entity in ("teacher", "teachers"):
        title, headers, rows, empty_message = build_teachers_export(user)
        return title, headers, rows, empty_message

    title = str(data.get("title") or "Export")
    headers = [str(h) for h in (data.get("headers") or [])]
    rows = data.get("rows") or []
    return title, headers, rows, None

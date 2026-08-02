"""Helpers for gating lesson video / file URLs by enrollment."""

from __future__ import annotations

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, user_has_role
from apps.content.permissions import _get_student_profile, user_teaches_course


ACTIVE_ENROLLMENT_STATUSES = ("APPROVED", "ACTIVE", "COMPLETED")


def student_enrolled_in_course(user, course) -> bool:
    student = _get_student_profile(user)
    if student is None or course is None:
        return False
    return student.enrollments.filter(
        course_id=getattr(course, "pk", course),
        status__in=ACTIVE_ENROLLMENT_STATUSES,
    ).exists()


def user_can_access_part_media(user, part) -> bool:
    """Admins/teachers (of course) / enrolled students / preview parts."""
    if user is None or not getattr(user, "is_authenticated", False):
        return bool(getattr(part, "is_preview", False))
    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        return True
    course = getattr(getattr(part, "chapter", None), "course", None)
    if user_has_role(user, ROLE_TEACHER) and user_teaches_course(user, course):
        return True
    if getattr(part, "is_preview", False):
        return True
    return student_enrolled_in_course(user, course)

"""
Permissions for enrollments API.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_STUDENT,
    ROLE_TEACHER,
    user_has_role,
)
from apps.common.rbac import resolve_permission_codename, user_has_rbac_permission


def _get_student(user):
    return getattr(user, "student", None) or getattr(user, "student_profile", None)


def _get_teacher(user):
    return getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)


class EnrollmentPermission(BasePermission):
    """
    Admin: full.
    Student: create & manage own (read/list own; no approve).
    Teacher: read enrollments for their courses/batches.
    """

    message = "You do not have permission for this enrollment."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            if user_has_role(request.user, ROLE_TEACHER):
                required = resolve_permission_codename(module="enrollments", view=view, request=request)
                return user_has_rbac_permission(request.user, required)
            return True
        if view.action in ("approve", "reject", "cancel", "complete"):
            # cancel allowed for student (own) + admin; approve/reject/complete admin
            if view.action == "cancel":
                return user_has_role(
                    request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT
                )
            return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)
        if request.method == "POST":
            return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT)
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True

        enrollment = obj if hasattr(obj, "student_id") else getattr(obj, "enrollment", obj)

        if user_has_role(request.user, ROLE_TEACHER):
            if request.method not in SAFE_METHODS and view.action not in (
                "approve",
                "reject",
                "cancel",
                "complete",
            ):
                return False
            teacher = _get_teacher(request.user)
            if teacher is None:
                return False
            batch = getattr(enrollment, "batch", None)
            if batch is not None and batch.teacher_id == teacher.pk:
                return True
            course = getattr(enrollment, "course", None)
            if course is None:
                return False
            if getattr(course, "created_by_id", None) == request.user.pk:
                return True
            instructors = getattr(course, "instructors", None)
            if instructors is not None and instructors.filter(teacher=teacher).exists():
                return True
            return False

        if user_has_role(request.user, ROLE_STUDENT):
            student = _get_student(request.user)
            if student is None:
                return False
            if getattr(enrollment, "student_id", None) != student.pk:
                return False
            if request.method in SAFE_METHODS:
                return True
            if view.action == "cancel":
                return enrollment.status in (
                    enrollment.Status.PENDING,
                    enrollment.Status.ACTIVE,
                    enrollment.Status.APPROVED,
                )
            # Students may only create (handled at collection) — no update of others' fields
            return False

        return False

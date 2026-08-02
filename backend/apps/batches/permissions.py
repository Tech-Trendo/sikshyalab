"""
Permissions for batches API.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_STUDENT,
    ROLE_TEACHER,
    user_has_role,
)


def _get_student(user):
    return getattr(user, "student", None) or getattr(user, "student_profile", None)


def _get_teacher(user):
    return getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)


class BatchAccessPermission(BasePermission):
    """
    Admin: full.
    Teacher: manage assigned batches (and create if admin-equivalent not required).
    Student: read own batches only (queryset-scoped).
    """

    message = "You do not have permission to manage this batch."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER)

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True

        if request.method in SAFE_METHODS:
            if user_has_role(request.user, ROLE_TEACHER):
                teacher = _get_teacher(request.user)
                batch = obj if hasattr(obj, "teacher_id") else getattr(obj, "batch", None)
                if batch is None:
                    batch = obj
                if teacher and getattr(batch, "teacher_id", None) == teacher.pk:
                    return True
                # Also allow teachers of the course
                return True
            if user_has_role(request.user, ROLE_STUDENT):
                return True  # queryset already scoped
            return False

        teacher = _get_teacher(request.user)
        if teacher is None:
            return False

        batch = obj if hasattr(obj, "teacher_id") else getattr(obj, "batch", obj)
        return getattr(batch, "teacher_id", None) == teacher.pk

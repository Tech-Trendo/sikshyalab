"""Attendance-module permission helpers."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_STUDENT,
    ROLE_TEACHER,
    user_has_role,
)


def get_student_for_user(user):
    student = getattr(user, "student", None)
    if student is not None:
        return student
    try:
        from apps.students.models import Student

        return Student.objects.filter(user=user).first()
    except Exception:
        return None


def get_teacher_for_user(user):
    teacher = getattr(user, "teacher", None)
    if teacher is not None:
        return teacher
    try:
        from apps.teachers.models import Teacher

        return Teacher.objects.filter(user=user).first()
    except Exception:
        return None


class CanMarkStudentAttendance(BasePermission):
    """Admin or teacher can mark student attendance."""

    message = "Admin or teacher privileges required to mark attendance."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER)


class CanViewOwnAttendance(BasePermission):
    """
    Admin: all.
    Teacher: mark student attendance; view own teacher attendance.
    Student: view own student attendance.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True

        teacher = get_teacher_for_user(request.user)
        student = get_student_for_user(request.user)

        if hasattr(obj, "teacher_id") and teacher and obj.teacher_id == teacher.pk:
            return True
        if hasattr(obj, "student_id") and student and obj.student_id == student.pk:
            return request.method in SAFE_METHODS or user_has_role(
                request.user, ROLE_TEACHER, ROLE_ADMIN, ROLE_STAFF
            )
        if teacher and request.method not in SAFE_METHODS:
            return True
        return False

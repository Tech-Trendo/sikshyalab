"""Assignment-module permission helpers."""

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


class IsAssignmentAdminOrTeacher(BasePermission):
    """Admins and teachers can manage assignments."""

    message = "Teacher or admin privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER)


class IsAssignmentParticipant(BasePermission):
    """
    Admin: all.
    Teacher: manage own course assignments / grade.
    Student: read allocated + submit.
    """

    message = "You do not have access to this assignment resource."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER):
            return True
        if user_has_role(request.user, ROLE_STUDENT):
            write_actions = {"create", "update", "partial_update", "destroy"}
            if getattr(view, "action", None) in write_actions and view.__class__.__name__ not in (
                "SubmissionViewSet",
            ):
                return False
            return True
        return False

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True

        teacher = get_teacher_for_user(request.user)
        student = get_student_for_user(request.user)

        assignment = getattr(obj, "assignment", obj)
        if hasattr(assignment, "teacher_id") and teacher and assignment.teacher_id == teacher.pk:
            return True

        if student is None:
            return request.method in SAFE_METHODS and teacher is not None

        # Student ownership checks
        if hasattr(obj, "student_id"):
            return obj.student_id == student.pk
        if hasattr(obj, "submission"):
            return obj.submission.student_id == student.pk
        if hasattr(obj, "allocations"):
            return True  # filtered in queryset
        return request.method in SAFE_METHODS

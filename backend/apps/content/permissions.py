"""
App-level permissions for course content.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import user_has_role, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, ROLE_STUDENT


def _get_student_profile(user):
    return getattr(user, "student", None) or getattr(user, "student_profile", None)


def _get_teacher_profile(user):
    return getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)


def user_teaches_course(user, course) -> bool:
    """True if the user is an instructor on the course or assigned via CourseInstructor."""
    teacher = _get_teacher_profile(user)
    if teacher is None or course is None:
        return False

    # Direct created_by
    if getattr(course, "created_by_id", None) == user.pk:
        return True

    instructors = getattr(course, "instructors", None)
    if instructors is not None:
        return instructors.filter(teacher=teacher).exists()

    # Fallback related name variants
    for related in ("course_instructors", "courseinstructor_set"):
        manager = getattr(course, related, None)
        if manager is not None and manager.filter(teacher=teacher).exists():
            return True
    return False


class IsAdminOrTeacherContentManager(BasePermission):
    """
    Admins: full access.
    Teachers: manage content for courses they teach.
    Students: read published content only (enforced in queryset).
    """

    message = "You do not have permission to manage this content."

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
            return True

        if not user_has_role(request.user, ROLE_TEACHER):
            return False

        course = None
        if hasattr(obj, "course"):
            course = obj.course if not callable(obj.course) else None
            if course is None and hasattr(obj, "course_id"):
                from apps.courses.models import Course

                course = Course.objects.filter(pk=obj.course_id).first()
        if course is None and hasattr(obj, "chapter"):
            course = getattr(obj.chapter, "course", None)
        if course is None and hasattr(obj, "part"):
            course = getattr(obj.part.chapter, "course", None)

        return user_teaches_course(request.user, course)


class IsStudentOwnProgress(BasePermission):
    """Students may only create/update their own progress; admins/teachers can read."""

    message = "You can only manage your own progress."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(request.user, ROLE_TEACHER) and request.method in SAFE_METHODS:
            return True
        student = _get_student_profile(request.user)
        if student is None:
            return False
        return getattr(obj, "student_id", None) == student.pk

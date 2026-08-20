"""Permission classes for the certificates module."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, ROLE_TEACHER, user_has_role
from apps.common.rbac import user_has_rbac_permission



def _get_student_for_user(user):
    student = getattr(user, "student", None) or getattr(user, "student_profile", None)
    if student is not None:
        return student
    try:
        from apps.students.models import Student

        return Student.objects.filter(user=user).first()
    except Exception:
        return None


class IsAdminOrStaff(BasePermission):
    message = "Admin or staff privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)


class IsAdminOrOwnCertificateRead(BasePermission):
    """
    Admins/staff: full access.
    Students: read-only on their own certificates.
    """

    message = "You may only view your own certificates."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(request.user, ROLE_TEACHER):
            # Teacher-only read permission is controlled via RBAC.
            return request.method in SAFE_METHODS and user_has_rbac_permission(
                request.user, "certificates.view"
            )
        if user_has_role(request.user, ROLE_STUDENT):
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if request.method not in SAFE_METHODS:
            return False

        if user_has_role(request.user, ROLE_TEACHER):
            # Certificates belong to a course; teacher can read certificates for
            # courses they teach.
            teacher = getattr(request.user, "teacher", None) or getattr(
                request.user, "teacher_profile", None
            )
            if teacher is None:
                return False
            course = getattr(obj, "course", None)
            if course is None and hasattr(obj, "certificate"):
                course = getattr(obj.certificate, "course", None)
            if course is None:
                return False
            return course.instructors.filter(teacher=teacher).exists()

        student = _get_student_for_user(request.user)
        if student is None:
            return False
        if hasattr(obj, "student_id"):
            return obj.student_id == student.pk
        if hasattr(obj, "certificate"):
            return obj.certificate.student_id == student.pk
        return False

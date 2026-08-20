"""
Role-based permissions for the students app.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import user_has_role, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, ROLE_STUDENT
from apps.common.rbac import resolve_permission_codename, user_has_rbac_permission


class IsAdminOrTeacherReadStudentWriteOwn(BasePermission):
    """
    - Admin: full access
    - Teacher: list / retrieve (safe methods)
    - Student: retrieve / update own profile only
    """

    message = "You do not have permission to perform this action on student records."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            if request.method not in SAFE_METHODS:
                return False
            required = resolve_permission_codename(module="students", view=view, request=request)
            return user_has_rbac_permission(user, required)
        if user_has_role(user, ROLE_STUDENT):
            return view.action in ("list", "retrieve", "partial_update", "update", "me")
        return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            return request.method in SAFE_METHODS
        if user_has_role(user, ROLE_STUDENT):
            student_user = getattr(obj, "user", None)
            if student_user is None and hasattr(obj, "student"):
                student_user = getattr(obj.student, "user", None)
            return student_user == user and request.method in (
                "GET",
                "HEAD",
                "OPTIONS",
                "PUT",
                "PATCH",
            )
        return False


class IsAdminOrStudentOwnerRelated(BasePermission):
    """
    Admin full access; students manage related records on their own profile;
    teachers read-only.
    """

    message = "You do not have permission for this student-related resource."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            return request.method in SAFE_METHODS
        if user_has_role(user, ROLE_STUDENT):
            return True
        return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            return request.method in SAFE_METHODS
        if user_has_role(user, ROLE_STUDENT):
            student = getattr(obj, "student", None)
            if student is None:
                return False
            return student.user_id == user.id
        return False


class IsAdminOrReadOnlyActivityLog(BasePermission):
    """Activity logs: admin full; others read-only for accessible students."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if request.method not in SAFE_METHODS:
            return False
        if user_has_role(user, ROLE_TEACHER):
            return True
        if user_has_role(user, ROLE_STUDENT):
            return obj.student.user_id == user.id
        return False

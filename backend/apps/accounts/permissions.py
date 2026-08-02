from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminRole(BasePermission):
    """Allow access only to authenticated users with ADMIN role."""

    message = "Admin access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (getattr(user, "role", None) == "ADMIN" or user.is_superuser)
        )


class IsAdminOrReadOnly(BasePermission):
    """Allow read to authenticated users; write only to admins."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(user, "role", None) == "ADMIN" or user.is_superuser


class IsOwnerOrAdmin(BasePermission):
    """Object-level permission: owner or admin."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "role", None) == "ADMIN" or user.is_superuser:
            return True
        owner = getattr(obj, "user", None)
        if owner is not None:
            return owner == user
        return obj == user


class IsTeacherRole(BasePermission):
    """Allow access to teachers (and admins)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                getattr(user, "role", None) in ("TEACHER", "ADMIN")
                or user.is_superuser
            )
        )


class IsStudentRole(BasePermission):
    """Allow access to students (and admins)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                getattr(user, "role", None) in ("STUDENT", "ADMIN")
                or user.is_superuser
            )
        )

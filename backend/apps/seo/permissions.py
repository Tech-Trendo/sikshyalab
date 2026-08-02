"""Permission classes for the SEO module."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role


class IsAdminOrStaffWrite(BasePermission):
    """Public read for indexed SEO; admin/staff write."""

    message = "Admin or staff privileges required for write operations."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)
        )


class IsAdminOrStaff(BasePermission):
    message = "Admin or staff privileges required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)
        )

"""Permissions for the notifications app."""

from rest_framework.permissions import BasePermission

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role


class IsNotificationOwnerOrAdmin(BasePermission):
    message = "You may only access your own notifications."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True
        recipient = getattr(obj, "recipient", None)
        if recipient is not None:
            return recipient == request.user
        owner = getattr(obj, "user", None)
        return owner == request.user


class IsAdminForBroadcast(BasePermission):
    message = "Admin privileges required to broadcast notifications."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)


class CanSendManualNotification(BasePermission):
    """
    Super Admin / Admin / Staff: broadcast freely.
    Teachers: only to assigned students / batches (enforced in serializer).
    """

    message = "You do not have permission to send notifications."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        return getattr(user, "role", None) == "TEACHER" or getattr(user, "is_teacher", False)


class IsAdminForAnalytics(BasePermission):
    message = "Admin privileges required for notification analytics."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)

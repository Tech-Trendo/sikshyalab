"""Custom DRF authentication that blocks inactive students with HTTP 403."""

from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import APIException
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.students.services import ACCOUNT_DEACTIVATED_MESSAGE, is_student_inactive


class AccountDeactivated(APIException):
    status_code = 403
    default_detail = ACCOUNT_DEACTIVATED_MESSAGE
    default_code = "account_deactivated"


def reject_if_student_inactive(user) -> None:
    if is_student_inactive(user):
        raise AccountDeactivated(ACCOUNT_DEACTIVATED_MESSAGE)


class ShikshaLabJWTAuthentication(JWTAuthentication):
    """JWT auth that denies INACTIVE students with 403 on every request."""

    def get_user(self, validated_token):
        """
        Load user and enforce student status.

        Inactive Django users who are deactivated students get 403 (not 401)
        so clients can show the deactivation message.
        """
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
        from rest_framework_simplejwt.settings import api_settings

        User = get_user_model()
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError as exc:
            raise InvalidToken(_("Token contained no recognizable user identification")) from exc

        try:
            # Prefetch student_profile so is_student_inactive() avoids an extra query
            # on every authenticated request.
            user = User.objects.select_related("student_profile").get(
                **{api_settings.USER_ID_FIELD: user_id}
            )
        except User.DoesNotExist as exc:
            raise AuthenticationFailed(_("User not found"), code="user_not_found") from exc

        if is_student_inactive(user):
            raise AccountDeactivated(ACCOUNT_DEACTIVATED_MESSAGE)

        if not api_settings.USER_AUTHENTICATION_RULE(user):
            raise AuthenticationFailed(_("User is inactive"), code="user_inactive")

        return user


class ShikshaLabSessionAuthentication(SessionAuthentication):
    """Session auth that denies INACTIVE students with 403."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, auth = result
        reject_if_student_inactive(user)
        return user, auth

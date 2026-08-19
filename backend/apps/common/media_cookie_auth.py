"""Cookie-based JWT authentication for media streaming only."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.common.media_cookie import read_media_cookie
from apps.students.services import is_student_inactive

User = get_user_model()


class MediaCookieAuthentication(authentication.BaseAuthentication):
    """
    Authenticate solely from the httpOnly ``sl_media_session`` cookie.

    * Never reads ``Authorization`` or URL query tokens.
    * Missing/invalid cookie → ``None`` (do not raise 401) so the stream view
      can respond with an opaque 404.
    * ``authenticate_header`` is ``None`` so DRF does not emit ``WWW-Authenticate``.
    """

    def authenticate(self, request):
        raw = read_media_cookie(request)
        if not raw:
            return None

        try:
            token = AccessToken(raw)
            user_id = token.get("user_id")
            if not user_id:
                return None
            user = (
                User.objects.select_related("student_profile")
                .filter(pk=user_id)
                .first()
            )
            if user is None:
                return None
            if is_student_inactive(user):
                return None
            if not user.is_active:
                return None
            return (user, token)
        except (InvalidToken, TokenError):
            return None
        except Exception:
            return None

    def authenticate_header(self, request):
        # Suppress WWW-Authenticate on 401 paths; stream uses 404 instead.
        return None

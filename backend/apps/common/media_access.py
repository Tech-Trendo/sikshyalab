"""Authenticated / gated media file serving (local disk or S3-compatible)."""

from __future__ import annotations

import mimetypes
import os
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404, HttpResponseForbidden, HttpResponseRedirect
from django.views import View
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.common.media_utils import MEDIA_ALIASES

User = get_user_model()

# Marketing / CMS assets — publicly readable
PUBLIC_MEDIA_PREFIXES = (
    "cms/",
    "courses/thumbnails/",
    "courses/banners/",
    "seo/",
    "certificates/templates/",
    "certificates/qr/",
    "certificates/settings/",
    "avatars/",
    "profile_images/",
)

# Lesson resources, submissions, PII — require authentication
PRIVATE_MEDIA_PREFIXES = (
    "content/",
    "enrollments/",
    "assignments/",
    "students/",
    "teachers/",
    "receipts/",
    "certificates/pdf/",
)


def normalize_media_relpath(path: str) -> str:
    cleaned = (path or "").replace("\\", "/").lstrip("/")
    if ".." in cleaned.split("/"):
        raise Http404("Invalid media path.")
    return cleaned


def is_public_media(relpath: str) -> bool:
    return any(relpath.startswith(prefix) for prefix in PUBLIC_MEDIA_PREFIXES)


def is_private_media(relpath: str) -> bool:
    return any(relpath.startswith(prefix) for prefix in PRIVATE_MEDIA_PREFIXES)


def resolve_user_from_request(request):
    """Accept Authorization Bearer or ?access_token= (for <video>/<img> tags)."""
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user

    raw = None
    auth = request.META.get("HTTP_AUTHORIZATION") or ""
    if auth.lower().startswith("bearer "):
        raw = auth.split(" ", 1)[1].strip()
    if not raw:
        raw = request.GET.get("access_token") or request.GET.get("token")
    if not raw:
        return None

    try:
        token = AccessToken(raw)
        user_id = token.get("user_id")
        if not user_id:
            return None
        user = User.objects.filter(pk=user_id, is_active=True).first()
        if user is None:
            return None
        from apps.students.services import is_student_inactive

        if is_student_inactive(user):
            return None
        return user
    except (InvalidToken, TokenError, Exception):
        return None


def user_can_access_media(user, relpath: str) -> bool:
    if is_public_media(relpath):
        return True
    if not is_private_media(relpath):
        # Unknown paths: require auth as a safe default
        return bool(user and user.is_authenticated)
    return bool(user and user.is_authenticated)


def _storage_candidates(relpath: str) -> list[str]:
    candidates = [relpath]
    alias = MEDIA_ALIASES.get(relpath) or MEDIA_ALIASES.get(relpath.lower())
    if alias and alias not in candidates:
        candidates.append(alias)
    return candidates


def _resolve_storage_key(relpath: str) -> str | None:
    for key in _storage_candidates(relpath):
        try:
            if default_storage.exists(key):
                return key
        except Exception:
            continue
    return None


def _serve_from_storage(relpath: str):
    """Redirect to a signed/public object URL when using S3-compatible storage."""
    key = _resolve_storage_key(relpath)
    if not key:
        raise Http404("File not found.")
    url = default_storage.url(key)
    response = HttpResponseRedirect(url)
    if is_private_media(relpath):
        response["Cache-Control"] = "private, no-store"
    else:
        response["Cache-Control"] = "public, max-age=86400"
    return response


def _serve_from_disk(relpath: str):
    root = Path(settings.MEDIA_ROOT).resolve()
    full = (root / relpath).resolve()
    if not str(full).startswith(str(root)) or not full.is_file():
        alias = MEDIA_ALIASES.get(relpath) or MEDIA_ALIASES.get(relpath.lower())
        if alias:
            full = (root / alias).resolve()
        if not str(full).startswith(str(root)) or not full.is_file():
            parent = (root / relpath).parent
            matched = None
            if parent.is_dir():
                target = Path(relpath).name.lower()
                for sibling in parent.iterdir():
                    if sibling.is_file() and sibling.name.lower() == target:
                        matched = sibling.resolve()
                        break
            if matched and str(matched).startswith(str(root)):
                full = matched
            else:
                raise Http404("File not found.")

    content_type, _ = mimetypes.guess_type(str(full))
    response = FileResponse(open(full, "rb"), content_type=content_type or "application/octet-stream")
    response["Content-Disposition"] = f'inline; filename="{os.path.basename(full)}"'
    response["X-Content-Type-Options"] = "nosniff"
    if is_private_media(relpath):
        response["Cache-Control"] = "private, no-store"
    else:
        response["Cache-Control"] = "public, max-age=86400"
    return response


class AuthenticatedMediaView(View):
    """
    Gate media access, then serve from local MEDIA_ROOT or redirect to S3.

    Private lesson/student files require a valid JWT (header or access_token query).
    """

    def get(self, request, path: str = ""):
        relpath = normalize_media_relpath(path)
        if not relpath:
            raise Http404("Not found.")

        if not user_can_access_media(resolve_user_from_request(request), relpath):
            return HttpResponseForbidden("Authentication required for this media file.")

        if getattr(settings, "USE_S3", False):
            return _serve_from_storage(relpath)
        return _serve_from_disk(relpath)

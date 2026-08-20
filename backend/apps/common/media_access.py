"""Authenticated / gated media file serving (local disk or S3-compatible)."""

from __future__ import annotations

import logging
import mimetypes
import os
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404, HttpResponseForbidden
from django.views import View
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.common.media_utils import (
    MEDIA_ALIASES,
    cache_storage_object_locally,
    local_media_file_exists,
    promote_local_file_to_s3,
)

logger = logging.getLogger(__name__)
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
    """
    Resolve the user for ``/media/`` gateway requests.

    Accepts session/DRF user, ``Authorization: Bearer``, or the httpOnly media
    cookie. Never accepts tokens from URL query parameters.
    """
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user

    raw = None
    auth = request.META.get("HTTP_AUTHORIZATION") or ""
    if auth.lower().startswith("bearer "):
        raw = auth.split(" ", 1)[1].strip()
    if not raw:
        from apps.common.media_cookie import read_media_cookie

        raw = read_media_cookie(request)
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
    """
    Gate ``/media/<path>`` downloads.

    Marketing CMS/SEO/avatar assets remain readable without auth so the public
    site can render. Lesson content (``content/``, assignments, PII, etc.)
    always requires an authenticated user (Bearer or media cookie — never query).
    """
    if is_public_media(relpath):
        return True
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if relpath.startswith("assignments/"):
        from apps.assignments.permissions import user_can_access_assignment_media

        return user_can_access_assignment_media(user, relpath)
    return True


def _storage_candidates(relpath: str) -> list[str]:
    candidates = [relpath]
    alias = MEDIA_ALIASES.get(relpath) or MEDIA_ALIASES.get(relpath.lower())
    if alias and alias not in candidates:
        candidates.append(alias)
    return candidates


def _resolve_storage_key(relpath: str) -> str | None:
    """
    Resolve a PostgreSQL FileField key to an object available in S3.

    Hybrid migration: if the key is missing on S3 but a legacy local file
    exists under MEDIA_ROOT, promote it to S3 (same key, no DB change).
    """
    for key in _storage_candidates(relpath):
        try:
            if default_storage.exists(key):
                return key
        except Exception as exc:
            logger.warning("media.s3.exists_failed key=%s err=%s", key, exc)

    if getattr(settings, "USE_S3", False):
        for key in _storage_candidates(relpath):
            if local_media_file_exists(key):
                try:
                    if promote_local_file_to_s3(key):
                        logger.info("media.hybrid.promoted key=%s", key)
                        return key
                except Exception:
                    logger.exception("media.hybrid.promote_failed key=%s", key)
    return None


def _content_type_for_key(key: str, fh) -> str:
    guessed, _ = mimetypes.guess_type(key)
    if guessed:
        return guessed
    try:
        obj = getattr(fh, "obj", None)
        if obj is not None:
            ctype = obj.get("ContentType")
            if ctype:
                return ctype
    except Exception:
        pass
    return "application/octet-stream"


def _serve_from_storage(relpath: str):
    """
    Stream the object through Django (HTTP 200 + bytes) from S3.

    PostgreSQL keys are treated as S3 object keys (under AWS_LOCATION).
    Legacy local files are promoted to S3 on first request. Objects are
    also mirrored under MEDIA_ROOT so DEBUG static() can serve them.
    """
    key = _resolve_storage_key(relpath)
    if not key:
        raise Http404("File not found.")

    cache_storage_object_locally(key)

    try:
        fh = default_storage.open(key, "rb")
    except Exception:
        logger.exception("media.s3.open_failed relpath=%s key=%s", relpath, key)
        raise Http404("File not found.")

    content_type = _content_type_for_key(key, fh)
    response = FileResponse(fh, content_type=content_type)
    response["Content-Disposition"] = f'inline; filename="{os.path.basename(key)}"'
    response["X-Content-Type-Options"] = "nosniff"
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


def debug_media_serve(request, path, document_root=None):
    """DEBUG media route — always auth-gated (never serve private files anonymously)."""
    return AuthenticatedMediaView.as_view()(request, path=path)


class AuthenticatedMediaView(View):
    """
    Gate media access, then stream bytes from S3 (USE_S3) or local MEDIA_ROOT.

    Private lesson/student files require a valid JWT (Bearer or media cookie).
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

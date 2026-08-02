"""Authenticated / gated media file serving."""

from __future__ import annotations

import mimetypes
import os
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import FileResponse, Http404, HttpResponseForbidden
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
        return User.objects.filter(pk=user_id, is_active=True).first()
    except (InvalidToken, TokenError, Exception):
        return None


def user_can_access_media(user, relpath: str) -> bool:
    if is_public_media(relpath):
        return True
    if not is_private_media(relpath):
        # Unknown paths: require auth as a safe default
        return bool(user and user.is_authenticated)
    return bool(user and user.is_authenticated)


class AuthenticatedMediaView(View):
    """
    Serve MEDIA_ROOT files with public/private gating.

    Private lesson/student files require a valid JWT (header or access_token query).
    """

    def get(self, request, path: str = ""):
        relpath = normalize_media_relpath(path)
        if not relpath:
            raise Http404("Not found.")

        if not user_can_access_media(resolve_user_from_request(request), relpath):
            return HttpResponseForbidden("Authentication required for this media file.")

        root = Path(settings.MEDIA_ROOT).resolve()
        full = (root / relpath).resolve()
        if not str(full).startswith(str(root)) or not full.is_file():
            # Legacy filename aliases (e.g. iic_logo.jpg → IIC.jpg)
            alias = MEDIA_ALIASES.get(relpath) or MEDIA_ALIASES.get(relpath.lower())
            if alias:
                full = (root / alias).resolve()
            if not str(full).startswith(str(root)) or not full.is_file():
                # Case-insensitive sibling match (Windows uploads / renamed files)
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
        # Discourage caching of private learning assets
        if is_private_media(relpath):
            response["Cache-Control"] = "private, no-store"
        else:
            response["Cache-Control"] = "public, max-age=86400"
        return response

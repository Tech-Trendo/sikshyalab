"""Signed URL helpers for PartResource (video / image / pdf / notes)."""

from __future__ import annotations

import logging
import mimetypes
from pathlib import Path
from typing import Any

from django.conf import settings

from apps.common.signed_urls import generate_presigned_get_url, signed_url_expiry_seconds
from apps.content.access import user_can_access_part_media
from apps.content.models import PartResource

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}
PDF_EXTENSIONS = {".pdf"}
NOTES_EXTENSIONS = {
    ".doc",
    ".docx",
    ".txt",
    ".md",
    ".rtf",
    ".odt",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".csv",
}


def detect_resource_media_type(resource: PartResource) -> str:
    """
    Map a PartResource to a frontend media kind: video | image | pdf | notes.

    Prefers ``resource_type``, then falls back to the stored filename extension.
    """
    rtype = (resource.resource_type or "").upper()
    if rtype == PartResource.ResourceType.VIDEO:
        return "video"
    if rtype == PartResource.ResourceType.PDF:
        return "pdf"
    if rtype == PartResource.ResourceType.DOC:
        return "notes"

    name = ""
    if resource.file:
        name = resource.file.name or ""
    elif resource.original_file:
        name = resource.original_file.name or ""
    ext = Path(name).suffix.lower()

    if ext in VIDEO_EXTENSIONS:
        return "video"
    if ext in PDF_EXTENSIONS:
        return "pdf"
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in NOTES_EXTENSIONS:
        return "notes"

    guessed, _ = mimetypes.guess_type(name)
    if guessed:
        if guessed.startswith("video/"):
            return "video"
        if guessed.startswith("image/"):
            return "image"
        if guessed == "application/pdf":
            return "pdf"
        if guessed.startswith("text/") or "document" in guessed or "sheet" in guessed:
            return "notes"

    if rtype == PartResource.ResourceType.LINK:
        return "notes"
    return "notes"


def resource_playable_file_name(resource: PartResource) -> str | None:
    """Prefer compressed/playable ``file``, fall back to ``original_file``."""
    if resource.file and resource.file.name:
        return resource.file.name
    if resource.original_file and resource.original_file.name:
        return resource.original_file.name
    return None


def user_can_access_resource(user, resource: PartResource) -> bool:
    return user_can_access_part_media(user, resource.part)


def build_signed_resource_payload(
    resource: PartResource,
    *,
    request=None,
    access_token: str | None = None,
) -> dict[str, Any]:
    """
    Build ``{url, type, expires_in}`` for an authorized resource.

    Raises ``ValueError`` when no file is stored (e.g. LINK-only row).

    Note: ``access_token`` is accepted for call-site compatibility but is
    intentionally ignored — never append JWTs to URLs.
    """
    relative = resource_playable_file_name(resource)
    if not relative:
        raise ValueError("Resource has no downloadable file.")

    expires_in = signed_url_expiry_seconds()
    url = generate_presigned_get_url(relative, expires_in=expires_in)

    if not getattr(settings, "USE_S3", False):
        if request is not None and not url.startswith("http"):
            url = request.build_absolute_uri(url)

    return {
        "url": url,
        "type": detect_resource_media_type(resource),
        "expires_in": expires_in,
    }


def extract_bearer_token(request) -> str | None:
    auth = request.META.get("HTTP_AUTHORIZATION") or ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip() or None
    return None

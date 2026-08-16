"""Presigned / gated media URL helpers (S3-compatible DataHub or local gateway)."""

from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


def storage_object_key(relative_name: str) -> str:
    """Map a Django FileField.name to the full object key in the bucket."""
    cleaned = (relative_name or "").replace("\\", "/").lstrip("/")
    loc = (getattr(settings, "AWS_LOCATION", None) or "").strip("/")
    if loc and cleaned and not cleaned.startswith(f"{loc}/"):
        return f"{loc}/{cleaned}"
    return cleaned


def generate_presigned_get_url(relative_name: str, *, expires_in: int | None = None) -> str:
    """
    Return a time-limited GET URL for a private object.

    When ``USE_S3`` is true, returns a SigV4 presigned S3 URL.
    Otherwise returns a relative ``/media/<key>`` path (caller may absolutize
    and attach a JWT query token for <video>/<img> tags).
    """
    cleaned = (relative_name or "").replace("\\", "/").lstrip("/")
    if not cleaned:
        raise ValueError("Empty storage key.")

    expire = int(
        expires_in
        if expires_in is not None
        else getattr(settings, "MEDIA_SIGNED_URL_EXPIRE", 900)
    )

    if not getattr(settings, "USE_S3", False):
        base = (getattr(settings, "MEDIA_URL", None) or "/media/").rstrip("/")
        return f"{base}/{cleaned}"

    from apps.videos.services.s3 import presigned_url

    key = storage_object_key(cleaned)
    return presigned_url(key, expires_in=expire)


def signed_url_expiry_seconds() -> int:
    return int(getattr(settings, "MEDIA_SIGNED_URL_EXPIRE", 900))

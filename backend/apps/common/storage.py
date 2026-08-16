"""S3-compatible media storage (DataHub / AWS S3).

Hybrid media architecture
-------------------------
* PostgreSQL FileField/ImageField values store **relative object keys only**
  (e.g. ``cms/gallery/IMG_2672.jpg``) — never binary blobs.
* When ``USE_S3=true``, ``default_storage`` is this backend: all **new** saves
  go to the configured bucket under ``AWS_LOCATION`` (if set).
* New uploads also mirror into local ``MEDIA_ROOT`` so DEBUG can serve
  ``/media/...`` from disk (``static(MEDIA_URL, document_root=MEDIA_ROOT)``).
* Public API responses expose the ``/media/<key>`` gateway; the view streams
  from S3 (SigV4 endpoint).
"""

from __future__ import annotations

from botocore.client import Config
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class MediaStorage(S3Boto3Storage):
    """
    Default media backend for user uploads.

    Object keys are prefixed with AWS_LOCATION when set.
    Signed URLs are used when AWS_QUERYSTRING_AUTH is enabled (private bucket).
    """

    file_overwrite = False
    # Buckets with ACLs disabled need default_acl=None
    default_acl = None
    querystring_auth = True

    def __init__(self, **kwargs):
        # DataHub / ACL-disabled buckets reject x-amz-acl; never send public-read.
        acl = kwargs.get("default_acl", getattr(settings, "AWS_DEFAULT_ACL", None))
        if acl in ("", None, "none", "null") or str(acl).strip().lower() in {
            "public-read",
            "public-read-write",
            "authenticated-read",
        }:
            kwargs["default_acl"] = None

        kwargs.setdefault(
            "querystring_auth",
            getattr(settings, "AWS_QUERYSTRING_AUTH", True),
        )
        kwargs.setdefault(
            "querystring_expire",
            getattr(settings, "AWS_QUERYSTRING_EXPIRE", 3600),
        )
        kwargs.setdefault(
            "file_overwrite",
            getattr(settings, "AWS_S3_FILE_OVERWRITE", False),
        )

        location = getattr(settings, "AWS_LOCATION", "") or ""
        if location and "location" not in kwargs:
            kwargs["location"] = location

        # Force SigV4 + path-style addressing for S3-compatible DataHub endpoints.
        signature = (
            kwargs.pop("signature_version", None)
            or getattr(settings, "AWS_S3_SIGNATURE_VERSION", None)
            or "s3v4"
        )
        addressing = (
            kwargs.pop("addressing_style", None)
            or getattr(settings, "AWS_S3_ADDRESSING_STYLE", None)
            or "path"
        )
        existing_cfg = kwargs.get("client_config")
        if existing_cfg is None:
            kwargs["client_config"] = Config(
                signature_version=signature,
                s3={"addressing_style": addressing},
            )

        # Never invent a custom_domain that bypasses the Django /media gateway.
        kwargs.setdefault("custom_domain", None)

        super().__init__(**kwargs)

    def save(self, name, content, max_length=None):
        from apps.common.media_utils import (
            cache_storage_object_locally,
            clear_media_exists_cache,
        )

        result = super().save(name, content, max_length=max_length)
        cache_storage_object_locally(result)
        clear_media_exists_cache()
        return result

    def delete(self, name):
        from apps.common.media_utils import clear_media_exists_cache

        super().delete(name)
        clear_media_exists_cache()

    def url(self, name, parameters=None, expire=None, http_method=None):
        """
        Return the Django ``/media/<key>`` gateway path (not a raw signed S3 URL).

        PostgreSQL stores the relative key; AuthenticatedMediaView streams from S3.
        This keeps API ImageField/FileField responses stable across existing and
        new uploads without exposing SigV4 query strings to clients.
        """
        cleaned = (name or "").replace("\\", "/").lstrip("/")
        loc = (getattr(self, "location", None) or "").strip("/")
        if loc and cleaned.startswith(f"{loc}/"):
            cleaned = cleaned[len(loc) + 1 :]
        base = (getattr(settings, "MEDIA_URL", None) or "/media/").rstrip("/")
        return f"{base}/{cleaned}"

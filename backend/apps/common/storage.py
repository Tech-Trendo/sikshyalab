"""S3-compatible media storage (DataHub / MinIO / AWS).

PostgreSQL stores only the relative object key on FileField/ImageField.
Binary blobs live in the configured bucket when USE_S3=true.

django-storages reads AWS_* from Django settings automatically.
"""

from __future__ import annotations

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
        # Allow STORAGES OPTIONS / env to override class defaults.
        if getattr(settings, "AWS_DEFAULT_ACL", None) in ("", None):
            kwargs.setdefault("default_acl", None)
        kwargs.setdefault(
            "querystring_auth",
            getattr(settings, "AWS_QUERYSTRING_AUTH", True),
        )
        kwargs.setdefault(
            "file_overwrite",
            getattr(settings, "AWS_S3_FILE_OVERWRITE", False),
        )
        location = getattr(settings, "AWS_LOCATION", "") or ""
        if location and "location" not in kwargs:
            kwargs["location"] = location
        super().__init__(**kwargs)

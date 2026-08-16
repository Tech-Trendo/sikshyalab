from __future__ import annotations

import logging

import boto3
from botocore.config import Config
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)


def _require_s3_config() -> None:
    if not getattr(settings, "USE_S3", False):
        raise ImproperlyConfigured(
            "Video uploads require USE_S3=true and DataHub AWS_* credentials in .env."
        )
    if not settings.AWS_STORAGE_BUCKET_NAME:
        raise ImproperlyConfigured("AWS_STORAGE_BUCKET_NAME is required for S3 video uploads.")
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        raise ImproperlyConfigured("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required.")


def s3_client():
    _require_s3_config()
    kwargs = {
        "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
        "config": Config(
            signature_version=settings.AWS_S3_SIGNATURE_VERSION or "s3v4",
            s3={"addressing_style": settings.AWS_S3_ADDRESSING_STYLE or "path"},
        ),
    }
    if settings.AWS_S3_REGION_NAME:
        kwargs["region_name"] = settings.AWS_S3_REGION_NAME
    if settings.AWS_S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.AWS_S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def upload_file(path: str, key: str, content_type: str = "video/mp4") -> None:
    client = s3_client()
    extra = {"ContentType": content_type}
    if settings.AWS_DEFAULT_ACL:
        extra["ACL"] = settings.AWS_DEFAULT_ACL
    logger.info(
        "s3.upload_file bucket=%s key=%s endpoint=%s",
        settings.AWS_STORAGE_BUCKET_NAME,
        key,
        settings.AWS_S3_ENDPOINT_URL,
    )
    client.upload_file(path, settings.AWS_STORAGE_BUCKET_NAME, key, ExtraArgs=extra)
    logger.info("s3.upload_file ok key=%s", key)


def presigned_url(key: str, expires_in: int | None = None) -> str:
    return s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in or settings.VIDEO_DOWNLOAD_URL_EXPIRY_SECONDS,
    )


def delete_object(key: str) -> None:
    s3_client().delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)

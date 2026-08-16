"""Celery tasks for course content (video resource compression)."""

from __future__ import annotations

import logging
import tempfile
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.content.models import PartResource
from apps.videos.services.ffmpeg import compress_video, ffmpeg_available
from apps.videos.services.metadata import probe_video

try:
    from celery import shared_task
except ModuleNotFoundError:  # pragma: no cover

    def shared_task(*dargs, **dkwargs):
        def decorator(func):
            def _not_installed(*args, **kwargs):
                raise RuntimeError(
                    "Celery is not installed in this environment. "
                    "Install requirements (celery>=5.3) and run a worker."
                )

            func.delay = _not_installed
            func.apply_async = _not_installed
            return func

        if dargs and callable(dargs[0]) and len(dargs) == 1 and not dkwargs:
            return decorator(dargs[0])
        return decorator


logger = logging.getLogger(__name__)


def _download_storage_file(field, dest: Path) -> None:
    """Copy a Django FileField (local or S3) into ``dest``."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with field.open("rb") as src, dest.open("wb") as out:
        while True:
            chunk = src.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)


def _source_field(resource: PartResource):
    if resource.original_file:
        return resource.original_file
    return resource.file


@shared_task(
    bind=True,
    name="content.compress_part_resource_video",
    max_retries=1,
    soft_time_limit=25 * 60,
    time_limit=30 * 60,
)
def compress_part_resource_video(self, resource_id: int):
    """
    Background job: download uploaded video → FFmpeg compress → replace ``file``.

    Never raises out of the worker after marking the resource failed — Celery
    workers stay healthy; teachers see status=failed + error_message.
    """
    try:
        resource = PartResource.objects.get(pk=resource_id)
    except PartResource.DoesNotExist:
        logger.warning("content.compress missing resource_id=%s", resource_id)
        return False

    if resource.resource_type != PartResource.ResourceType.VIDEO:
        return False

    source = _source_field(resource)
    if not source:
        resource.status = PartResource.Status.FAILED
        resource.error_message = "No video file found to compress."
        resource.save(update_fields=["status", "error_message", "updated_at"])
        return False

    resource.status = PartResource.Status.PROCESSING
    resource.error_message = ""
    resource.save(update_fields=["status", "error_message", "updated_at"])

    try:
        if not ffmpeg_available():
            raise RuntimeError(
                "FFmpeg/ffprobe not found on PATH. Install FFmpeg on the worker host."
            )

        Path(settings.VIDEO_UPLOAD_TMP_DIR).mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=settings.VIDEO_UPLOAD_TMP_DIR) as tmpdir:
            tmp = Path(tmpdir)
            suffix = Path(source.name).suffix.lower() or ".mp4"
            input_path = tmp / f"input{suffix}"
            output_path = tmp / "compressed.mp4"

            _download_storage_file(source, input_path)
            meta = probe_video(str(input_path))
            compress_video(str(input_path), str(output_path))

            stem = Path(source.name).stem or f"resource-{resource.pk}"
            out_name = f"{stem}_compressed.mp4"

            with output_path.open("rb") as fh:
                resource.file.save(out_name, ContentFile(fh.read()), save=False)

            duration = meta.get("duration")
            if duration:
                resource.duration_seconds = max(0, int(round(float(duration))))

            resource.status = PartResource.Status.READY
            resource.error_message = ""
            resource.save()

            if not getattr(settings, "VIDEO_KEEP_ORIGINAL", True) and resource.original_file:
                try:
                    old_name = resource.original_file.name
                    resource.original_file.delete(save=False)
                    resource.original_file = None
                    resource.save(update_fields=["original_file", "updated_at"])
                    logger.info("content.compress deleted original key=%s", old_name)
                except Exception:
                    logger.exception(
                        "content.compress could not delete original resource_id=%s",
                        resource.pk,
                    )

            logger.info(
                "content.compress ok resource_id=%s duration=%s file=%s",
                resource.pk,
                resource.duration_seconds,
                resource.file.name,
            )
            return True
    except Exception as exc:
        logger.exception("content.compress failed resource_id=%s", resource_id)
        resource.status = PartResource.Status.FAILED
        resource.error_message = str(exc)[:1000] or "Video processing failed. Please try again."
        resource.save(update_fields=["status", "error_message", "updated_at"])
        return False


@shared_task(name="content.cleanup_stuck_resource_processing")
def cleanup_stuck_resource_processing():
    """Mark PartResource videos stuck in processing as failed."""
    stale_cutoff = timezone.now() - timedelta(hours=2)
    updated = PartResource.objects.filter(
        resource_type=PartResource.ResourceType.VIDEO,
        status=PartResource.Status.PROCESSING,
        updated_at__lt=stale_cutoff,
    ).update(
        status=PartResource.Status.FAILED,
        error_message="Processing timed out.",
    )
    if updated:
        logger.warning("content.compress marked %s stuck resources as failed", updated)
    return updated

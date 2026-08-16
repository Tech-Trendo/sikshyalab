from __future__ import annotations

import tempfile
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.videos.models import Video
from apps.videos.services.ffmpeg import compress_video
from apps.videos.services.metadata import probe_video
from apps.videos.services.s3 import s3_client, upload_file

try:
    from celery import shared_task
except ModuleNotFoundError:  # pragma: no cover - keeps Django importable without Celery installed
    def shared_task(*dargs, **dkwargs):
        def decorator(func):
            func.delay = func
            return func

        if dargs and callable(dargs[0]) and len(dargs) == 1 and not dkwargs:
            return decorator(dargs[0])
        return decorator


@shared_task(bind=True)
def compress_and_publish_video(self, video_id: str):
    video = Video.objects.get(pk=video_id)
    video.status = Video.Status.PROCESSING
    video.save(update_fields=["status", "updated_at"])
    try:
        Path(settings.VIDEO_UPLOAD_TMP_DIR).mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=settings.VIDEO_UPLOAD_TMP_DIR) as tmpdir:
            tmpdir = Path(tmpdir)
            input_path = tmpdir / "input"
            output_path = tmpdir / "compressed.mp4"
            s3 = s3_client()
            s3.download_file(settings.AWS_STORAGE_BUCKET_NAME, video.original_s3_key, str(input_path))
            meta = probe_video(str(input_path))
            compress_video(str(input_path), str(output_path))
            compressed_key = f"videos/{video.user_id}/{video.id}/compressed.mp4"
            upload_file(str(output_path), compressed_key)
            compressed_size = output_path.stat().st_size
            video.compressed_s3_key = compressed_key
            video.compressed_size = compressed_size
            video.compression_percentage = (
                round((1 - compressed_size / video.original_size) * 100, 2)
                if video.original_size
                else None
            )
            video.duration = meta["duration"]
            video.width = meta["width"]
            video.height = meta["height"]
            video.fps = meta["fps"]
            video.codec = meta["codec"]
            video.bitrate = meta["bitrate"]
            video.status = Video.Status.COMPLETED
            video.error_message = ""
            video.save()
            return True
    except Exception as exc:
        video.status = Video.Status.FAILED
        video.error_message = "Video processing failed. Please try again."
        video.save(update_fields=["status", "error_message", "updated_at"])
        raise exc


@shared_task(bind=True)
def cleanup_stuck_processing(self):
    stale_cutoff = timezone.now() - timedelta(hours=2)
    Video.objects.filter(
        status=Video.Status.PROCESSING,
        updated_at__lt=stale_cutoff,
    ).update(status=Video.Status.FAILED, error_message="Processing timed out.")

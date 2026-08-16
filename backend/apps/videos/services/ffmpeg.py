from __future__ import annotations

import logging
import os
import shutil
import subprocess

from django.conf import settings

logger = logging.getLogger(__name__)


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def compress_video(input_path: str, output_path: str, *, max_height: int | None = None) -> None:
    """
    Compress ``input_path`` to H.264/AAC MP4 for web streaming.

    Example command::

        ffmpeg -y -i input.mp4 \\
          -c:v libx264 -preset medium -crf 23 \\
          -vf scale=-2:720:force_original_aspect_ratio=decrease \\
          -c:a aac -b:a 128k \\
          -movflags +faststart -pix_fmt yuv420p \\
          -map 0:v:0 -map 0:a? \\
          output.mp4
    """
    height = max_height if max_height is not None else int(getattr(settings, "VIDEO_MAX_HEIGHT", 720) or 0)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-c:v",
        settings.VIDEO_CODEC,
        "-preset",
        settings.VIDEO_PRESET,
        "-crf",
        str(settings.VIDEO_CRF),
        "-c:a",
        settings.AUDIO_CODEC,
        "-b:a",
        settings.AUDIO_BITRATE,
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
    ]
    if height and height > 0:
        # Downscale to max height while preserving aspect ratio (never upscales).
        cmd.extend(
            [
                "-vf",
                f"scale=-2:{height}:force_original_aspect_ratio=decrease",
            ]
        )
    cmd.append(output_path)

    logger.info("ffmpeg.compress cmd=%s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = (result.stderr or result.stdout or "").strip()
        logger.error("ffmpeg.compress failed code=%s stderr=%s", result.returncode, stderr[-2000:])
        raise RuntimeError(stderr[-500:] or "FFmpeg compression failed.")
    if not os.path.isfile(output_path) or os.path.getsize(output_path) <= 0:
        raise RuntimeError("FFmpeg produced an empty output file.")

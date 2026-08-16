from __future__ import annotations

import json
import math
import subprocess


def probe_video(path: str) -> dict:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    streams = data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), {})
    format_data = data.get("format", {})
    fps = None
    rate = video_stream.get("r_frame_rate") or video_stream.get("avg_frame_rate")
    if rate and rate != "0/0":
        num, den = rate.split("/")
        if float(den or 0):
            fps = float(num) / float(den)
    return {
        "duration": float(format_data.get("duration") or 0) or None,
        "width": int(video_stream.get("width") or 0) or None,
        "height": int(video_stream.get("height") or 0) or None,
        "fps": fps,
        "codec": video_stream.get("codec_name") or "",
        "bitrate": int(format_data.get("bit_rate") or video_stream.get("bit_rate") or 0) or None,
    }

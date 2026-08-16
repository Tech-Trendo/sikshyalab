"""Server-side streaming of PartResource files (no client-side S3 URLs)."""

from __future__ import annotations

import logging
import mimetypes
import re
from pathlib import Path

from django.core.files.storage import default_storage
from django.http import FileResponse, HttpResponse, StreamingHttpResponse

from apps.content.resource_signed_urls import (
    detect_resource_media_type,
    resource_playable_file_name,
)

logger = logging.getLogger(__name__)

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _content_type_for(name: str, media_kind: str) -> str:
    guessed, _ = mimetypes.guess_type(name or "")
    if guessed:
        return guessed
    return {
        "video": "video/mp4",
        "image": "image/jpeg",
        "pdf": "application/pdf",
        "notes": "application/octet-stream",
    }.get(media_kind, "application/octet-stream")


def _protection_headers(content_type: str) -> dict[str, str]:
    return {
        "Content-Type": content_type,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
    }


def _file_size(name: str) -> int | None:
    try:
        return int(default_storage.size(name))
    except Exception:
        return None


def _open_range(name: str, start: int, end: int):
    """
    Open a storage object, preferring S3 Range GETs when available.
    Falls back to seeking a local file-like object.
    """
    storage = default_storage
    # django-storages S3: connection.meta.client.get_object(Range=...)
    try:
        bucket = getattr(storage, "bucket_name", None) or getattr(storage, "bucket", None)
        if bucket is not None and hasattr(storage, "connection"):
            client = storage.connection.meta.client
            loc = (getattr(storage, "location", "") or "").strip("/")
            key = name.lstrip("/")
            if loc and not key.startswith(f"{loc}/"):
                key = f"{loc}/{key}"
            bucket_name = bucket if isinstance(bucket, str) else getattr(bucket, "name", None)
            obj = client.get_object(
                Bucket=bucket_name,
                Key=key,
                Range=f"bytes={start}-{end}",
            )
            body = obj["Body"]
            return body, int(obj.get("ContentLength") or (end - start + 1))
    except Exception:
        logger.debug("media.stream s3_range_fallback name=%s", name, exc_info=True)

    fh = storage.open(name, "rb")
    try:
        fh.seek(start)
    except Exception:
        # Non-seekable: read and discard (last resort)
        remaining = start
        while remaining > 0:
            chunk = fh.read(min(1024 * 1024, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
    length = end - start + 1

    def iterator():
        left = length
        try:
            while left > 0:
                chunk = fh.read(min(64 * 1024, left))
                if not chunk:
                    break
                left -= len(chunk)
                yield chunk
        finally:
            try:
                fh.close()
            except Exception:
                pass

    return iterator(), length


def build_resource_stream_response(request, resource):
    """
    Stream a PartResource file through Django with optional HTTP Range (206).

    Never returns a bucket URL — bytes are fetched with server credentials.
    """
    relative = resource_playable_file_name(resource)
    if not relative:
        return HttpResponse("No file.", status=404)

    media_kind = detect_resource_media_type(resource)
    content_type = _content_type_for(relative, media_kind)
    headers = _protection_headers(content_type)
    total = _file_size(relative)

    range_header = request.META.get("HTTP_RANGE") or ""
    if range_header and total is not None and total > 0:
        match = _RANGE_RE.match(range_header.strip())
        if match:
            start_s, end_s = match.group(1), match.group(2)
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else total - 1
            if end >= total:
                end = total - 1
            if start > end or start < 0:
                resp = HttpResponse(status=416)
                resp["Content-Range"] = f"bytes */{total}"
                return resp

            body, length = _open_range(relative, start, end)
            if callable(body):
                response = StreamingHttpResponse(body(), status=206, content_type=content_type)
            else:
                response = StreamingHttpResponse(body, status=206, content_type=content_type)
            for k, v in headers.items():
                response[k] = v
            response["Content-Length"] = str(length)
            response["Content-Range"] = f"bytes {start}-{end}/{total}"
            return response

    # Full-file response
    try:
        fh = default_storage.open(relative, "rb")
    except Exception:
        logger.exception("media.stream open_failed key=%s", relative)
        return HttpResponse("File not found.", status=404)

    response = FileResponse(fh, content_type=content_type)
    for k, v in headers.items():
        response[k] = v
    if total is not None:
        response["Content-Length"] = str(total)
    filename = Path(relative).name
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response

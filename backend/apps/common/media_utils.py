"""Helpers for media file existence checks and placeholder fallbacks.

Hybrid S3 mode (``USE_S3=true``):
* Existence checks and saves use ``default_storage`` (S3).
* New uploads are also mirrored under local ``MEDIA_ROOT`` so DEBUG
  ``static(MEDIA_URL, document_root=MEDIA_ROOT)`` can serve CMS images.
* API serializers keep the PostgreSQL relative key and expose ``/media/<key>``.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from shutil import copyfileobj

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

# Relative object key — always present after ensure_placeholder()
PLACEHOLDER_RELPATH = "cms/placeholders/missing.png"

# Stale DB / browser URLs → current keys (legacy renames)
MEDIA_ALIASES: dict[str, str] = {
    "cms/partners/iic_logo.jpg": "cms/partners/IIC.jpg",
    "cms/partners/iic_logo.jpeg": "cms/partners/IIC.jpg",
    "cms/partners/iic_logo.png": "cms/partners/IIC.jpg",
}


def media_root() -> Path:
    return Path(settings.MEDIA_ROOT).resolve()


def abs_media_path(relpath: str) -> Path:
    cleaned = (relpath or "").replace("\\", "/").lstrip("/")
    return (media_root() / cleaned).resolve()


def normalize_relpath(relpath: str | None) -> str:
    return (relpath or "").replace("\\", "/").lstrip("/")


def local_media_file_exists(relpath: str | None) -> bool:
    """True when a legacy file still exists under local MEDIA_ROOT (read-only)."""
    cleaned = normalize_relpath(relpath)
    if not cleaned:
        return False
    path = abs_media_path(cleaned)
    root = media_root()
    try:
        return str(path).startswith(str(root)) and path.is_file()
    except OSError:
        return False


@lru_cache(maxsize=4096)
def media_file_exists(relpath: str | None) -> bool:
    """True when the object exists in the active storage backend (S3 or local)."""
    cleaned = normalize_relpath(relpath)
    if not cleaned:
        return False
    if getattr(settings, "USE_S3", False):
        try:
            return default_storage.exists(cleaned)
        except Exception:
            return False
    path = abs_media_path(cleaned)
    root = media_root()
    try:
        return str(path).startswith(str(root)) and path.is_file()
    except OSError:
        return False


def clear_media_exists_cache() -> None:
    media_file_exists.cache_clear()


def cache_storage_object_locally(relpath: str) -> Path | None:
    """Copy an object from active storage (S3) into ``MEDIA_ROOT`` if missing.

    Returns the local path when the file exists on disk afterwards.
    Does not change PostgreSQL FileField keys.
    """
    cleaned = normalize_relpath(relpath)
    if not cleaned:
        return None
    dest = abs_media_path(cleaned)
    root = media_root()
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.is_file() and str(dest.resolve()).startswith(str(root)):
            return dest
        if not default_storage.exists(cleaned):
            return None
        with default_storage.open(cleaned, "rb") as src, dest.open("wb") as out:
            copyfileobj(src, out)
        if dest.is_file() and str(dest.resolve()).startswith(str(root)):
            return dest
    except Exception:
        logger.warning("media.local_cache_failed key=%s", cleaned, exc_info=True)
        try:
            if dest.exists() and dest.stat().st_size == 0:
                dest.unlink()
        except OSError:
            pass
    return None


def promote_local_file_to_s3(relpath: str) -> bool:
    """
    Upload a legacy local MEDIA_ROOT file to S3 at the same relative key.

    Does not change PostgreSQL. Returns True if the object is now on S3.
    """
    cleaned = normalize_relpath(relpath)
    if not cleaned or not getattr(settings, "USE_S3", False):
        return False
    clear_media_exists_cache()
    if media_file_exists(cleaned):
        return True
    if not local_media_file_exists(cleaned):
        return False
    path = abs_media_path(cleaned)
    data = path.read_bytes()
    # Exact key: object is missing, so get_available_name keeps `cleaned`.
    saved = default_storage.save(cleaned, ContentFile(data, name=Path(cleaned).name))
    clear_media_exists_cache()
    if saved == cleaned or media_file_exists(cleaned):
        return True
    # Rare rename: put bytes under the exact DB key via low-level API.
    try:
        client = default_storage.connection.meta.client
        bucket = default_storage.bucket_name
        location = (getattr(default_storage, "location", "") or "").strip("/")
        full_key = f"{location}/{cleaned}" if location else cleaned
        extra = {}
        ctype, _ = __import__("mimetypes").guess_type(cleaned)
        if ctype:
            extra["ContentType"] = ctype
        client.put_object(Bucket=bucket, Key=full_key, Body=data, **extra)
        clear_media_exists_cache()
        return media_file_exists(cleaned)
    except Exception:
        return False


def ensure_placeholder() -> str:
    """
    Ensure the shared placeholder object exists in active storage.

    When USE_S3=true, writes **only** to S3 (in-memory PNG) — never to MEDIA_ROOT.
    Returns the relative key ``PLACEHOLDER_RELPATH``.
    """
    from PIL import Image, ImageDraw

    if media_file_exists(PLACEHOLDER_RELPATH):
        return PLACEHOLDER_RELPATH

    img = Image.new("RGB", (640, 360), color=(230, 233, 238))
    draw = ImageDraw.Draw(img)
    draw.rectangle([24, 24, 616, 336], outline=(180, 186, 196), width=3)
    draw.line([(24, 24), (616, 336)], fill=(200, 205, 214), width=2)
    draw.line([(616, 24), (24, 336)], fill=(200, 205, 214), width=2)
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    data = buf.getvalue()

    if getattr(settings, "USE_S3", False):
        default_storage.save(PLACEHOLDER_RELPATH, ContentFile(data, name="missing.png"))
        clear_media_exists_cache()
        return PLACEHOLDER_RELPATH

    dest = abs_media_path(PLACEHOLDER_RELPATH)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.is_file():
        dest.write_bytes(data)
    return PLACEHOLDER_RELPATH


def resolve_media_relpath(
    relpath: str | None,
    *,
    fallback_placeholder: bool = False,
) -> str | None:
    """
    Normalize a DB FileField name to a relative media key.

    By default returns the original key (hybrid: PostgreSQL key == S3 key)
    even if the object is not yet on S3 — the /media gateway / sync command
    promote legacy local files. Set ``fallback_placeholder=True`` only when
    a guaranteed existing asset is required.
    """
    if not relpath:
        return None
    cleaned = normalize_relpath(relpath)
    if not cleaned:
        return None
    alias = MEDIA_ALIASES.get(cleaned) or MEDIA_ALIASES.get(cleaned.lower())
    if alias and media_file_exists(alias):
        return alias
    if media_file_exists(cleaned):
        return cleaned
    if alias:
        return alias
    if fallback_placeholder:
        ensure_placeholder()
        return PLACEHOLDER_RELPATH
    return cleaned


def resolve_existing_relpath(relpath: str | None) -> str | None:
    """
    Return a relative media path preferred for display.

    Tries the original path / aliases on storage; if still missing and a local
    legacy file exists under MEDIA_ROOT, returns the original key (caller may
    promote). Falls back to placeholder only when nothing can be resolved.
    """
    if not relpath:
        return None
    cleaned = normalize_relpath(relpath)
    if media_file_exists(cleaned):
        return cleaned
    alias = MEDIA_ALIASES.get(cleaned) or MEDIA_ALIASES.get(cleaned.lower())
    if alias and media_file_exists(alias):
        return alias
    # Case-insensitive match within the same directory (local disk only)
    if not getattr(settings, "USE_S3", False):
        candidate = abs_media_path(cleaned)
        if candidate.parent.is_dir():
            target = candidate.name.lower()
            for sibling in candidate.parent.iterdir():
                if sibling.is_file() and sibling.name.lower() == target:
                    return (
                        f"{cleaned.rsplit('/', 1)[0]}/{sibling.name}"
                        if "/" in cleaned
                        else sibling.name
                    )
    # Hybrid: keep DB key if local legacy file exists (will be promoted on serve)
    if getattr(settings, "USE_S3", False) and (
        local_media_file_exists(cleaned)
        or (alias and local_media_file_exists(alias))
    ):
        return alias if alias and local_media_file_exists(alias) else cleaned
    ensure_placeholder()
    return PLACEHOLDER_RELPATH


def restore_aliased_files() -> list[str]:
    """Ensure alias source objects exist in active storage. Returns restored keys."""
    restored: list[str] = []
    for missing, source in MEDIA_ALIASES.items():
        if media_file_exists(missing):
            continue
        if getattr(settings, "USE_S3", False):
            if local_media_file_exists(source) and promote_local_file_to_s3(source):
                # Also place under the legacy alias key when needed
                if not media_file_exists(missing) and local_media_file_exists(source):
                    with abs_media_path(source).open("rb") as fh:
                        default_storage.save(missing, ContentFile(fh.read()))
                    clear_media_exists_cache()
                    restored.append(missing)
                elif media_file_exists(source) and not media_file_exists(missing):
                    with default_storage.open(source, "rb") as fh:
                        default_storage.save(missing, ContentFile(fh.read()))
                    clear_media_exists_cache()
                    restored.append(missing)
            continue
        if not media_file_exists(source):
            continue
        dest = abs_media_path(missing)
        dest.parent.mkdir(parents=True, exist_ok=True)
        import shutil

        shutil.copy2(abs_media_path(source), dest)
        restored.append(missing)
    return restored


def absolute_media_url(request, relpath: str) -> str:
    url = f"{settings.MEDIA_URL.rstrip('/')}/{normalize_relpath(relpath)}"
    if request is not None:
        return request.build_absolute_uri(url)
    return url

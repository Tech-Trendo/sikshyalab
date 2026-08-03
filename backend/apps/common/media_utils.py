"""Helpers for media file existence checks and placeholder fallbacks."""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage

# Relative to MEDIA_ROOT — always present after `fix_missing_media` / ensure_placeholder()
PLACEHOLDER_RELPATH = "cms/placeholders/missing.png"

# Stale DB / browser URLs → current on-disk files (legacy renames)
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


def media_file_exists(relpath: str | None) -> bool:
    if not relpath:
        return False
    cleaned = relpath.replace("\\", "/").lstrip("/")
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


def ensure_placeholder() -> Path:
    """Create a small grey PNG placeholder if missing. Returns absolute local path."""
    from io import BytesIO

    from django.core.files.base import ContentFile
    from PIL import Image, ImageDraw

    dest = abs_media_path(PLACEHOLDER_RELPATH)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.is_file():
        img = Image.new("RGB", (640, 360), color=(230, 233, 238))
        draw = ImageDraw.Draw(img)
        draw.rectangle([24, 24, 616, 336], outline=(180, 186, 196), width=3)
        draw.line([(24, 24), (616, 336)], fill=(200, 205, 214), width=2)
        draw.line([(616, 24), (24, 336)], fill=(200, 205, 214), width=2)
        img.save(dest, format="PNG", optimize=True)

    if getattr(settings, "USE_S3", False) and not media_file_exists(PLACEHOLDER_RELPATH):
        buf = BytesIO()
        Image.open(dest).save(buf, format="PNG", optimize=True)
        buf.seek(0)
        default_storage.save(PLACEHOLDER_RELPATH, ContentFile(buf.read()))

    return dest


def resolve_existing_relpath(relpath: str | None) -> str | None:
    """
    Return a relative media path that exists in storage.
    Tries the original path, then aliases, then the shared placeholder.
    """
    if not relpath:
        return None
    cleaned = relpath.replace("\\", "/").lstrip("/")
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
    ensure_placeholder()
    if media_file_exists(PLACEHOLDER_RELPATH):
        return PLACEHOLDER_RELPATH
    return None


def restore_aliased_files() -> list[str]:
    """Copy alias targets onto missing legacy filenames. Returns restored relative paths."""
    import shutil

    restored: list[str] = []
    for missing, source in MEDIA_ALIASES.items():
        if media_file_exists(missing):
            continue
        if not media_file_exists(source):
            continue
        dest = abs_media_path(missing)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(abs_media_path(source), dest)
        restored.append(missing)
    return restored


def absolute_media_url(request, relpath: str) -> str:
    url = f"{settings.MEDIA_URL.rstrip('/')}/{relpath.lstrip('/')}"
    if request is not None:
        return request.build_absolute_uri(url)
    return url

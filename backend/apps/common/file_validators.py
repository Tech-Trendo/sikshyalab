"""Upload validators — type (extension/MIME) and size limits."""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible


def _mb(n: int) -> int:
    return n * 1024 * 1024


# Defaults (overridable via settings)
DEFAULT_IMAGE_EXTENSIONS = ("jpg", "jpeg", "png", "gif", "webp")
DEFAULT_DOCUMENT_EXTENSIONS = ("pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv")
DEFAULT_VIDEO_EXTENSIONS = ("mp4", "webm", "mov", "mkv")
DEFAULT_AUDIO_EXTENSIONS = ("mp3", "wav", "ogg", "m4a")

DEFAULT_IMAGE_MAX_BYTES = _mb(5)
DEFAULT_DOCUMENT_MAX_BYTES = _mb(20)
DEFAULT_VIDEO_MAX_BYTES = _mb(200)
DEFAULT_AUDIO_MAX_BYTES = _mb(30)
DEFAULT_GENERIC_MAX_BYTES = _mb(20)


def _ext(filename: str) -> str:
    name = (filename or "").rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return name.rsplit(".", 1)[-1].lower().strip()


@deconstructible
class FileSizeValidator:
    """Reject uploads larger than ``max_bytes``."""

    message = "File size %(size)s exceeds the limit of %(limit)s."
    code = "file_too_large"

    def __init__(self, max_bytes: int, message: str | None = None):
        self.max_bytes = int(max_bytes)
        if message:
            self.message = message

    def __call__(self, file_obj):
        size = getattr(file_obj, "size", None)
        if size is None:
            return
        if size > self.max_bytes:
            raise ValidationError(
                self.message,
                code=self.code,
                params={
                    "size": _human_bytes(size),
                    "limit": _human_bytes(self.max_bytes),
                },
            )

    def __eq__(self, other):
        return isinstance(other, FileSizeValidator) and self.max_bytes == other.max_bytes


@deconstructible
class FileExtensionTypeValidator:
    """Reject uploads whose extension is not in the allow-list."""

    message = "File type '.%(ext)s' is not allowed. Allowed: %(allowed)s."
    code = "invalid_extension"

    def __init__(self, allowed_extensions: list[str] | tuple[str, ...], message: str | None = None):
        self.allowed_extensions = tuple(sorted({e.lower().lstrip(".") for e in allowed_extensions}))
        if message:
            self.message = message

    def __call__(self, file_obj):
        name = getattr(file_obj, "name", "") or ""
        ext = _ext(name)
        if not ext or ext not in self.allowed_extensions:
            raise ValidationError(
                self.message,
                code=self.code,
                params={
                    "ext": ext or "(none)",
                    "allowed": ", ".join(self.allowed_extensions),
                },
            )

    def __eq__(self, other):
        return (
            isinstance(other, FileExtensionTypeValidator)
            and self.allowed_extensions == other.allowed_extensions
        )


def _human_bytes(n: int) -> str:
    value = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            if unit == "B":
                return f"{int(value)} B"
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} GB"


def _setting(name: str, default):
    return getattr(settings, name, default)


def image_upload_validators():
    return [
        FileExtensionTypeValidator(
            _setting("MEDIA_ALLOWED_IMAGE_EXTENSIONS", DEFAULT_IMAGE_EXTENSIONS)
        ),
        FileSizeValidator(_setting("MEDIA_MAX_IMAGE_BYTES", DEFAULT_IMAGE_MAX_BYTES)),
    ]


def document_upload_validators():
    return [
        FileExtensionTypeValidator(
            _setting("MEDIA_ALLOWED_DOCUMENT_EXTENSIONS", DEFAULT_DOCUMENT_EXTENSIONS)
        ),
        FileSizeValidator(_setting("MEDIA_MAX_DOCUMENT_BYTES", DEFAULT_DOCUMENT_MAX_BYTES)),
    ]


def video_upload_validators():
    return [
        FileExtensionTypeValidator(
            _setting("MEDIA_ALLOWED_VIDEO_EXTENSIONS", DEFAULT_VIDEO_EXTENSIONS)
        ),
        FileSizeValidator(_setting("MEDIA_MAX_VIDEO_BYTES", DEFAULT_VIDEO_MAX_BYTES)),
    ]


def media_upload_validators():
    """Combined allow-list for mixed media uploads (images + docs + video + audio)."""
    exts = (
        tuple(_setting("MEDIA_ALLOWED_IMAGE_EXTENSIONS", DEFAULT_IMAGE_EXTENSIONS))
        + tuple(_setting("MEDIA_ALLOWED_DOCUMENT_EXTENSIONS", DEFAULT_DOCUMENT_EXTENSIONS))
        + tuple(_setting("MEDIA_ALLOWED_VIDEO_EXTENSIONS", DEFAULT_VIDEO_EXTENSIONS))
        + tuple(_setting("MEDIA_ALLOWED_AUDIO_EXTENSIONS", DEFAULT_AUDIO_EXTENSIONS))
    )
    return [
        FileExtensionTypeValidator(exts),
        FileSizeValidator(_setting("MEDIA_MAX_UPLOAD_BYTES", DEFAULT_GENERIC_MAX_BYTES)),
    ]


def validate_uploaded_file(file_obj, *, kind: str = "media") -> None:
    """
    Run validators for an InMemory/Temporary uploaded file.

    kind: "image" | "document" | "video" | "media"
    Raises django.core.exceptions.ValidationError.
    """
    mapping = {
        "image": image_upload_validators,
        "document": document_upload_validators,
        "video": video_upload_validators,
        "media": media_upload_validators,
    }
    factory = mapping.get(kind, media_upload_validators)
    for validator in factory():
        validator(file_obj)

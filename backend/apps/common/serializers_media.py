"""DRF helpers that keep media upload writable while returning safe URLs."""

from __future__ import annotations

from rest_framework import serializers

from apps.common.media_utils import absolute_media_url, normalize_relpath, resolve_media_relpath


class SafeMediaRepresentationMixin:
    """
    Mixin for ModelSerializers: after normal serialization, rewrite listed
    FileField/ImageField keys to the Django ``/media/<key>`` gateway URL.

    PostgreSQL keeps the relative key unchanged. Uploads still use the normal
    ImageField (which writes to S3 when USE_S3=true).
    """

    safe_media_fields: tuple[str, ...] = ()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        for field_name in getattr(self, "safe_media_fields", ()):
            val = getattr(instance, field_name, None)
            name = getattr(val, "name", None) if val else None
            if not name:
                data[field_name] = data.get(field_name) or None
                continue
            # Keep the DB key (hybrid S3). Do not replace missing objects with
            # placeholder here — that hides real gallery/course keys.
            rel = resolve_media_relpath(name, fallback_placeholder=False)
            data[field_name] = absolute_media_url(request, rel) if rel else None
        return data


class SafeMediaURLField(serializers.Field):
    """Read-only absolute ``/media/<key>`` URL for a FileField value."""

    def __init__(self, **kwargs):
        kwargs.setdefault("read_only", True)
        kwargs.setdefault("allow_null", True)
        super().__init__(**kwargs)

    def to_representation(self, value):
        if not value:
            return None
        name = getattr(value, "name", None) or str(value)
        if not name:
            return None
        rel = resolve_media_relpath(name, fallback_placeholder=False) or normalize_relpath(name)
        if not rel:
            return None
        return absolute_media_url(self.context.get("request"), rel)

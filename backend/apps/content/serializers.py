"""
Serializers for the content CMS API.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from apps.content.access import user_can_access_part_media
from apps.content.models import (
    Chapter,
    ChapterProgress,
    CourseProgress,
    Part,
    PartAttachment,
    PartResource,
    VideoPart,
    VideoTimestamp,
    StudentProgress,
)

logger = logging.getLogger(__name__)


def _request_user(serializer):
    request = serializer.context.get("request")
    return getattr(request, "user", None) if request else None


def _unique_slug(base: str, exists_fn) -> str:
    slug = slugify(base)[:240] or "item"
    candidate = slug
    n = 2
    while exists_fn(candidate):
        candidate = f"{slug}-{n}"
        n += 1
    return candidate


def _part_media_url(part) -> str:
    file_field = getattr(part, "video_file", None)
    if file_field:
        try:
            return file_field.url
        except ValueError:
            pass
    return getattr(part, "video_url", "") or ""


class VideoPartSerializer(serializers.ModelSerializer):
    video = serializers.PrimaryKeyRelatedField(queryset=Part.objects.all(), required=False)
    # CamelCase aliases for clients that send startTime/endTime
    startTime = serializers.IntegerField(source="start_time", required=False)
    endTime = serializers.IntegerField(source="end_time", required=False)

    class Meta:
        model = VideoPart
        fields = [
            "id",
            "video",
            "title",
            "start_time",
            "end_time",
            "startTime",
            "endTime",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators = []

    def validate(self, attrs):
        video = attrs.get("video") or getattr(self.instance, "video", None)
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        order = attrs.get("order", getattr(self.instance, "order", None))

        errors = {}
        if start_time is not None and start_time < 0:
            errors["start_time"] = "Start time must be greater than or equal to 0."
        if end_time is not None and start_time is not None and end_time <= start_time:
            errors["end_time"] = "End time must be greater than start time."
        if order is not None and order < 1:
            errors["order"] = "Order must be a positive integer."

        if video is not None and end_time is not None:
            duration = getattr(video, "video_duration_seconds", 0) or 0
            if duration and end_time > duration:
                errors["end_time"] = "End time cannot exceed the parent video duration."

        if video is not None and start_time is not None and end_time is not None:
            overlap_qs = VideoPart.objects.filter(video=video).exclude(
                pk=getattr(self.instance, "pk", None)
            ).filter(start_time__lt=end_time, end_time__gt=start_time)
            if overlap_qs.exists():
                errors["start_time"] = "Video parts cannot overlap within the same video."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        video = validated_data.get("video") or self.context.get("video")
        if video is None:
            raise serializers.ValidationError({"video": "This field is required."})
        validated_data["video"] = video
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.setdefault("video", instance.video)
        return super().update(instance, validated_data)


class VideoSerializer(serializers.ModelSerializer):
    parts = VideoPartSerializer(many=True, required=False, source="video_parts")
    duration = serializers.IntegerField(
        source="video_duration_seconds",
        min_value=0,
        required=False,
    )
    url = serializers.SerializerMethodField()
    video_file = serializers.FileField(write_only=True, required=False, allow_null=True)
    video_url = serializers.URLField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Part
        fields = [
            "id",
            "title",
            "description",
            "order",
            "video_file",
            "video_url",
            "duration",
            "url",
            "is_preview",
            "is_published",
            "estimated_minutes",
            "parts",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "url", "created_at", "updated_at"]

    def get_url(self, obj):
        return _part_media_url(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not user_can_access_part_media(_request_user(self), instance):
            data["url"] = ""
            data["parts"] = []
        return data

    def validate(self, attrs):
        title = attrs.get("title") or getattr(self.instance, "title", "")
        if not title:
            raise serializers.ValidationError({"title": "This field is required."})

        if self.instance is None:
            video_source = attrs.get("video_file") or attrs.get("video_url")
            if not video_source:
                raise serializers.ValidationError(
                    {"video_file": "Provide an uploaded video file or a video URL."}
                )

        parts = attrs.get("video_parts") or []
        if parts:
            seen_orders = set()
            ordered_ranges = []
            duration = attrs.get(
                "video_duration_seconds",
                getattr(self.instance, "video_duration_seconds", 0) or 0,
            )
            for part in parts:
                order = part.get("order")
                start_time = part.get("start_time")
                end_time = part.get("end_time")
                if start_time is None:
                    start_time = part.get("startTime")
                if end_time is None:
                    end_time = part.get("endTime")
                if order is None or order < 1:
                    raise serializers.ValidationError({"parts": "Each part must have a positive order."})
                if order in seen_orders:
                    raise serializers.ValidationError({"parts": "Part order must be unique within a video."})
                seen_orders.add(order)
                if start_time is None or end_time is None:
                    raise serializers.ValidationError({"parts": "Each part must include start and end times."})
                if start_time < 0:
                    raise serializers.ValidationError({"parts": "Start time cannot be negative."})
                if end_time <= start_time:
                    raise serializers.ValidationError({"parts": "End time must be greater than start time."})
                if duration and end_time > duration:
                    raise serializers.ValidationError({"parts": "Part end time cannot exceed the video duration."})
                part["start_time"] = start_time
                part["end_time"] = end_time
                ordered_ranges.append((order, start_time, end_time))

            ordered_ranges.sort(key=lambda item: (item[0], item[1]))
            for previous, current in zip(ordered_ranges, ordered_ranges[1:]):
                if current[1] < previous[2]:
                    raise serializers.ValidationError({"parts": "Video parts cannot overlap."})

        return attrs


class VideoTimestampSerializer(serializers.ModelSerializer):
    resource = serializers.PrimaryKeyRelatedField(
        queryset=PartResource.objects.all(),
        required=False,
    )

    class Meta:
        model = VideoTimestamp
        fields = [
            "id",
            "resource",
            "time_seconds",
            "label",
            "order",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_time_seconds(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError("time_seconds must be greater than or equal to 0.")
        return value

    def validate_label(self, value):
        label = (value or "").strip()
        if not label:
            raise serializers.ValidationError("Label is required.")
        return label

    def validate(self, attrs):
        resource = attrs.get("resource") or getattr(self.instance, "resource", None) or self.context.get("resource")
        time_seconds = attrs.get("time_seconds", getattr(self.instance, "time_seconds", None))

        if resource is None:
            raise serializers.ValidationError({"resource": "This field is required."})
        if resource.resource_type != PartResource.ResourceType.VIDEO:
            raise serializers.ValidationError(
                {"resource": "Timestamps can only be added to VIDEO resources."}
            )

        duration = getattr(resource, "duration_seconds", 0) or 0
        if duration and time_seconds is not None and time_seconds > duration:
            raise serializers.ValidationError(
                {"time_seconds": "Timestamp cannot exceed the video duration."}
            )

        attrs["resource"] = resource
        return attrs

    def create(self, validated_data):
        resource = validated_data.get("resource") or self.context.get("resource")
        if resource is None:
            raise serializers.ValidationError({"resource": "This field is required."})
        validated_data["resource"] = resource
        return super().create(validated_data)


class PartResourceSerializer(serializers.ModelSerializer):
    timestamps = VideoTimestampSerializer(many=True, read_only=True)
    has_file = serializers.SerializerMethodField()
    media_type = serializers.SerializerMethodField()
    # Write-only upload field — never returned as a raw/public URL in responses.
    file = serializers.FileField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = PartResource
        fields = [
            "id",
            "part",
            "title",
            "resource_type",
            "file",
            "has_file",
            "media_type",
            "external_url",
            "duration_seconds",
            "status",
            "error_message",
            "order",
            "timestamps",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "has_file",
            "media_type",
            "status",
            "error_message",
            "timestamps",
            "created_at",
            "updated_at",
        ]

    def get_has_file(self, instance):
        return bool(getattr(instance, "file", None) and instance.file.name) or bool(
            getattr(instance, "original_file", None) and instance.original_file.name
        )

    def get_media_type(self, instance):
        from apps.content.resource_signed_urls import detect_resource_media_type

        return detect_resource_media_type(instance)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Never expose raw bucket /media / signed URLs — clients use /stream/ with cookie.
        data.pop("file", None)
        data.pop("original_file", None)
        part = getattr(instance, "part", None)
        if part is not None and not user_can_access_part_media(_request_user(self), part):
            data["external_url"] = ""
            data["has_file"] = False
        return data

    def create(self, validated_data):
        resource_type = validated_data.get("resource_type") or PartResource.ResourceType.OTHER
        uploaded = validated_data.get("file")
        if resource_type == PartResource.ResourceType.VIDEO and uploaded:
            validated_data["status"] = PartResource.Status.UPLOADING
        else:
            validated_data.setdefault("status", PartResource.Status.READY)
        return super().create(validated_data)


class PartAttachmentSerializer(serializers.ModelSerializer):
    has_file = serializers.SerializerMethodField()
    file = serializers.FileField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = PartAttachment
        fields = [
            "id",
            "part",
            "title",
            "file",
            "has_file",
            "file_size",
            "file_type",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "has_file", "file_size", "file_type", "created_at", "updated_at"]

    def get_has_file(self, instance):
        return bool(getattr(instance, "file", None) and instance.file.name)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop("file", None)
        part = getattr(instance, "part", None)
        if part is not None and not user_can_access_part_media(_request_user(self), part):
            data["has_file"] = False
        return data


class PartSerializer(serializers.ModelSerializer):
    resources = PartResourceSerializer(many=True, read_only=True)
    attachments = PartAttachmentSerializer(many=True, read_only=True)
    video_parts = VideoPartSerializer(many=True, read_only=True)
    course = serializers.UUIDField(source="chapter.course_id", read_only=True)
    # slug is auto-generated from title, so it must not be required on create
    slug = serializers.SlugField(read_only=True)
    url = serializers.SerializerMethodField()
    duration = serializers.IntegerField(source="video_duration_seconds", read_only=True)

    class Meta:
        model = Part
        fields = [
            "id",
            "chapter",
            "course",
            "title",
            "slug",
            "description",
            "order",
            "content_type",
            "url",
            "video_url",
            "video_file",
            "duration",
            "video_duration_seconds",
            "notes",
            "is_preview",
            "is_published",
            "estimated_minutes",
            "resources",
            "attachments",
            "video_parts",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "course", "created_at", "updated_at"]

    def get_url(self, instance):
        return _part_media_url(instance)

    def validate(self, attrs):
        title = attrs.get("title") or getattr(self.instance, "title", "")
        chapter = attrs.get("chapter") or getattr(self.instance, "chapter", None)
        slug = (attrs.get("slug") or "").strip()
        if not slug and title and chapter is not None:
            attrs["slug"] = _unique_slug(
                title,
                lambda s: Part.objects.filter(chapter=chapter, slug=s)
                .exclude(pk=getattr(self.instance, "pk", None))
                .exists(),
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not user_can_access_part_media(_request_user(self), instance):
            data["url"] = ""
            data["video_url"] = ""
            data["video_parts"] = []
            if not instance.is_preview:
                data["notes"] = ""
        return data


class PartListSerializer(serializers.ModelSerializer):
    course = serializers.UUIDField(source="chapter.course_id", read_only=True)

    class Meta:
        model = Part
        fields = [
            "id",
            "chapter",
            "course",
            "title",
            "slug",
            "order",
            "content_type",
            "video_url",
            "notes",
            "description",
            "is_preview",
            "is_published",
            "estimated_minutes",
            "video_duration_seconds",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not user_can_access_part_media(_request_user(self), instance):
            data["video_url"] = ""
            if not instance.is_preview:
                data["notes"] = ""
        return data


class ChapterSerializer(serializers.ModelSerializer):
    video = VideoSerializer(required=False, allow_null=True)
    parts = PartListSerializer(many=True, read_only=True)
    parts_count = serializers.SerializerMethodField()
    # slug is auto-generated from title, so it must not be required on create
    slug = serializers.SlugField(read_only=True)

    class Meta:
        model = Chapter
        fields = [
            "id",
            "course",
            "title",
            "slug",
            "description",
            "order",
            "is_published",
            "duration_minutes",
            "video",
            "parts",
            "parts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "parts", "parts_count", "created_at", "updated_at"]

    def get_parts_count(self, obj):
        if hasattr(obj, "parts_count"):
            return obj.parts_count
        return obj.parts.count()

    def validate(self, attrs):
        title = attrs.get("title") or getattr(self.instance, "title", "")
        course = attrs.get("course") or getattr(self.instance, "course", None)
        slug = (attrs.get("slug") or "").strip()
        if not slug and title and course is not None:
            attrs["slug"] = _unique_slug(
                title,
                lambda s: Chapter.objects.filter(course=course, slug=s)
                .exclude(pk=getattr(self.instance, "pk", None))
                .exists(),
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        video_data = validated_data.pop("video", None)
        chapter = Chapter.objects.create(**validated_data)
        if video_data:
            self._sync_video(chapter, video_data)
        return chapter

    @transaction.atomic
    def update(self, instance, validated_data):
        video_data = validated_data.pop("video", None)
        chapter = super().update(instance, validated_data)
        if video_data is not None:
            self._sync_video(chapter, video_data)
        return chapter

    def _sync_video(self, chapter, video_data):
        parts_data = video_data.pop("video_parts", None)
        video = chapter.video
        if video is None:
            base_title = video_data.get("title") or chapter.title
            slug = _unique_slug(
                base_title,
                lambda candidate: Part.objects.filter(chapter=chapter, slug=candidate).exists(),
            )
            video = Part.objects.create(
                chapter=chapter,
                title=base_title,
                slug=slug,
                content_type=Part.ContentType.VIDEO,
                is_published=True,
            )
            chapter.video = video
            chapter.save(update_fields=["video", "updated_at"])

        for field in (
            "title",
            "description",
            "order",
            "video_file",
            "video_url",
            "video_duration_seconds",
            "is_preview",
            "is_published",
            "estimated_minutes",
        ):
            if field in video_data:
                setattr(video, field, video_data[field])

        video.content_type = Part.ContentType.VIDEO
        if not video.slug:
            video.slug = _unique_slug(
                video.title or chapter.title,
                lambda candidate: Part.objects.filter(chapter=chapter, slug=candidate).exclude(pk=video.pk).exists(),
            )
        video.save()
        if video.video_file:
            logger.info(
                "content.video_file saved use_s3=%s name=%s storage=%s",
                getattr(settings, "USE_S3", False),
                video.video_file.name,
                video.video_file.storage.__class__.__name__,
            )

        if parts_data is not None:
            video.video_parts.all().delete()
            if parts_data:
                VideoPart.objects.bulk_create(
                    [VideoPart(video=video, **part_data) for part_data in parts_data]
                )
        return video


class ChapterListSerializer(serializers.ModelSerializer):
    """
    List payload used by the dashboard after refresh.
    Include nested parts so saved lessons are returned without a second
    round-trip to /content/parts/.
    """

    video = VideoSerializer(read_only=True)
    parts = PartListSerializer(many=True, read_only=True)
    parts_count = serializers.SerializerMethodField()

    class Meta:
        model = Chapter
        fields = [
            "id",
            "course",
            "title",
            "slug",
            "description",
            "order",
            "is_published",
            "duration_minutes",
            "video",
            "parts",
            "parts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_parts_count(self, obj):
        if hasattr(obj, "parts_count"):
            return obj.parts_count
        # Prefer prefetched parts when available
        parts = getattr(obj, "_prefetched_objects_cache", {}).get("parts")
        if parts is not None:
            return len(parts)
        return obj.parts.count()


class StudentProgressSerializer(serializers.ModelSerializer):
    part_title = serializers.CharField(source="part.title", read_only=True)

    class Meta:
        model = StudentProgress
        fields = [
            "id",
            "student",
            "part",
            "part_title",
            "chapter",
            "course",
            "status",
            "progress_percent",
            "last_position_seconds",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "chapter",
            "course",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
            "part_title",
        ]


class StudentProgressWriteSerializer(serializers.Serializer):
    part = serializers.PrimaryKeyRelatedField(queryset=Part.objects.all())
    status = serializers.ChoiceField(
        choices=StudentProgress._meta.get_field("status").choices,
        required=False,
    )
    progress_percent = serializers.IntegerField(min_value=0, max_value=100, required=False)
    last_position_seconds = serializers.IntegerField(min_value=0, required=False)


class ChapterProgressSerializer(serializers.ModelSerializer):
    chapter_title = serializers.CharField(source="chapter.title", read_only=True)

    class Meta:
        model = ChapterProgress
        fields = [
            "id",
            "student",
            "chapter",
            "chapter_title",
            "status",
            "progress_percent",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CourseProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseProgress
        fields = [
            "id",
            "student",
            "course",
            "status",
            "progress_percent",
            "completed_parts",
            "total_parts",
            "last_accessed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

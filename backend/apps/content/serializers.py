"""
Serializers for the content CMS API.
"""

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
    StudentProgress,
)


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


class PartResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartResource
        fields = [
            "id",
            "part",
            "title",
            "resource_type",
            "file",
            "external_url",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        part = getattr(instance, "part", None)
        if part is not None and not user_can_access_part_media(_request_user(self), part):
            data["file"] = None
            data["external_url"] = ""
        return data


class PartAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartAttachment
        fields = [
            "id",
            "part",
            "title",
            "file",
            "file_size",
            "file_type",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "file_size", "file_type", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        part = getattr(instance, "part", None)
        if part is not None and not user_can_access_part_media(_request_user(self), part):
            data["file"] = None
        return data


class PartSerializer(serializers.ModelSerializer):
    resources = PartResourceSerializer(many=True, read_only=True)
    attachments = PartAttachmentSerializer(many=True, read_only=True)
    course = serializers.UUIDField(source="chapter.course_id", read_only=True)
    # slug is auto-generated from title, so it must not be required on create
    slug = serializers.SlugField(read_only=True)

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
            "video_url",
            "video_duration_seconds",
            "notes",
            "is_preview",
            "is_published",
            "estimated_minutes",
            "resources",
            "attachments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "course", "created_at", "updated_at"]

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
            data["video_url"] = ""
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


class ChapterListSerializer(serializers.ModelSerializer):
    parts_count = serializers.SerializerMethodField()

    class Meta:
        model = Chapter
        fields = [
            "id",
            "course",
            "title",
            "slug",
            "order",
            "is_published",
            "duration_minutes",
            "parts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_parts_count(self, obj):
        if hasattr(obj, "parts_count"):
            return obj.parts_count
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

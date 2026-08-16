from django.contrib import admin

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


class PartInline(admin.TabularInline):
    model = Part
    extra = 0
    fields = (
        "title",
        "slug",
        "order",
        "content_type",
        "is_preview",
        "is_published",
        "estimated_minutes",
    )
    show_change_link = True


class PartResourceInline(admin.TabularInline):
    model = PartResource
    extra = 0
    fields = (
        "title",
        "resource_type",
        "file",
        "original_file",
        "external_url",
        "duration_seconds",
        "status",
        "order",
    )


class PartAttachmentInline(admin.TabularInline):
    model = PartAttachment
    extra = 0
    fields = ("title", "file", "file_size", "file_type")
    readonly_fields = ("file_size", "file_type")


class VideoPartInline(admin.TabularInline):
    model = VideoPart
    extra = 0
    fields = ("title", "start_time", "end_time", "order")


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "course",
        "video",
        "order",
        "is_published",
        "duration_minutes",
        "created_at",
    )
    list_filter = ("is_published", "course")
    search_fields = ("title", "slug", "description")
    prepopulated_fields = {"slug": ("title",)}
    ordering = ("course", "order")
    inlines = [PartInline]


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "chapter",
        "content_type",
        "order",
        "is_preview",
        "is_published",
        "estimated_minutes",
    )
    list_filter = ("content_type", "is_published", "is_preview")
    search_fields = ("title", "slug", "description")
    prepopulated_fields = {"slug": ("title",)}
    raw_id_fields = ("chapter",)
    inlines = [PartResourceInline, PartAttachmentInline, VideoPartInline]


class VideoTimestampInline(admin.TabularInline):
    model = VideoTimestamp
    extra = 0
    fields = ("time_seconds", "label", "order")


@admin.register(PartResource)
class PartResourceAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "part",
        "resource_type",
        "status",
        "duration_seconds",
        "order",
        "created_at",
    )
    list_filter = ("resource_type", "status")
    search_fields = ("title", "external_url", "error_message")
    raw_id_fields = ("part",)
    readonly_fields = ("error_message", "created_at", "updated_at")
    inlines = [VideoTimestampInline]


@admin.register(VideoTimestamp)
class VideoTimestampAdmin(admin.ModelAdmin):
    list_display = ("label", "resource", "time_seconds", "order", "created_at")
    search_fields = ("label", "resource__title")
    raw_id_fields = ("resource",)
    ordering = ("resource", "time_seconds", "id")


@admin.register(PartAttachment)
class PartAttachmentAdmin(admin.ModelAdmin):
    list_display = ("title", "part", "file_type", "file_size", "created_at")
    list_filter = ("file_type",)
    search_fields = ("title",)
    raw_id_fields = ("part",)
    readonly_fields = ("file_size", "file_type")


@admin.register(VideoPart)
class VideoPartAdmin(admin.ModelAdmin):
    list_display = ("title", "video", "order", "start_time", "end_time", "created_at")
    list_filter = ("order",)
    search_fields = ("title",)
    raw_id_fields = ("video",)


@admin.register(StudentProgress)
class StudentProgressAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "part",
        "course",
        "status",
        "progress_percent",
        "updated_at",
    )
    list_filter = ("status", "course")
    search_fields = ("student__student_id", "part__title")
    raw_id_fields = ("student", "part", "chapter", "course")
    readonly_fields = ("started_at", "completed_at", "created_at", "updated_at")


@admin.register(ChapterProgress)
class ChapterProgressAdmin(admin.ModelAdmin):
    list_display = ("student", "chapter", "status", "progress_percent", "completed_at")
    list_filter = ("status",)
    raw_id_fields = ("student", "chapter")


@admin.register(CourseProgress)
class CourseProgressAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "course",
        "status",
        "progress_percent",
        "completed_parts",
        "total_parts",
        "last_accessed_at",
    )
    list_filter = ("status",)
    raw_id_fields = ("student", "course")

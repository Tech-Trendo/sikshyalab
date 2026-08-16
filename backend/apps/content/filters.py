"""
Django filters for the content CMS API.
"""

import django_filters

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


class ChapterFilter(django_filters.FilterSet):
    course = django_filters.UUIDFilter(field_name="course_id")
    is_published = django_filters.BooleanFilter()
    title = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Chapter
        fields = ["course", "is_published", "slug"]


class PartFilter(django_filters.FilterSet):
    chapter = django_filters.NumberFilter(field_name="chapter_id")
    course = django_filters.UUIDFilter(field_name="chapter__course_id")
    content_type = django_filters.CharFilter()
    is_published = django_filters.BooleanFilter()
    is_preview = django_filters.BooleanFilter()

    class Meta:
        model = Part
        fields = ["chapter", "course", "content_type", "is_published", "is_preview", "slug"]


class PartResourceFilter(django_filters.FilterSet):
    part = django_filters.NumberFilter(field_name="part_id")
    resource_type = django_filters.CharFilter()

    class Meta:
        model = PartResource
        fields = ["part", "resource_type"]


class PartAttachmentFilter(django_filters.FilterSet):
    part = django_filters.NumberFilter(field_name="part_id")
    file_type = django_filters.CharFilter()

    class Meta:
        model = PartAttachment
        fields = ["part", "file_type"]


class VideoPartFilter(django_filters.FilterSet):
    video = django_filters.NumberFilter(field_name="video_id")
    chapter = django_filters.NumberFilter(field_name="video__chapter_id")
    order = django_filters.NumberFilter()

    class Meta:
        model = VideoPart
        fields = ["video", "chapter", "order"]


class VideoTimestampFilter(django_filters.FilterSet):
    resource = django_filters.NumberFilter(field_name="resource_id")
    part = django_filters.NumberFilter(field_name="resource__part_id")

    class Meta:
        model = VideoTimestamp
        fields = ["resource", "part"]


class StudentProgressFilter(django_filters.FilterSet):
    student = django_filters.UUIDFilter(field_name="student_id")
    part = django_filters.NumberFilter(field_name="part_id")
    chapter = django_filters.NumberFilter(field_name="chapter_id")
    course = django_filters.UUIDFilter(field_name="course_id")
    status = django_filters.CharFilter()

    class Meta:
        model = StudentProgress
        fields = ["student", "part", "chapter", "course", "status"]


class ChapterProgressFilter(django_filters.FilterSet):
    student = django_filters.UUIDFilter(field_name="student_id")
    chapter = django_filters.NumberFilter(field_name="chapter_id")
    status = django_filters.CharFilter()

    class Meta:
        model = ChapterProgress
        fields = ["student", "chapter", "status"]


class CourseProgressFilter(django_filters.FilterSet):
    student = django_filters.UUIDFilter(field_name="student_id")
    course = django_filters.UUIDFilter(field_name="course_id")
    status = django_filters.CharFilter()

    class Meta:
        model = CourseProgress
        fields = ["student", "course", "status"]

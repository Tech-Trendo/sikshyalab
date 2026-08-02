"""
Progress aggregation helpers for course content.
"""

from django.db import transaction
from django.db.models import Avg
from django.utils import timezone

from apps.content.models import (
    Chapter,
    ChapterProgress,
    CourseProgress,
    Part,
    ProgressStatus,
    StudentProgress,
)


def _derive_status(progress_percent: int, completed: int, total: int) -> str:
    if total == 0:
        return ProgressStatus.NOT_STARTED
    if completed >= total or progress_percent >= 100:
        return ProgressStatus.COMPLETED
    if progress_percent <= 0 and completed == 0:
        return ProgressStatus.NOT_STARTED
    return ProgressStatus.IN_PROGRESS


@transaction.atomic
def recalculate_chapter_progress(student, chapter) -> ChapterProgress:
    """Recompute chapter progress from published part progress rows."""
    parts_qs = Part.objects.filter(chapter=chapter, is_published=True)
    total_parts = parts_qs.count()

    progress_qs = StudentProgress.objects.filter(
        student=student,
        chapter=chapter,
        part__in=parts_qs,
    )
    completed = progress_qs.filter(status=ProgressStatus.COMPLETED).count()
    avg = progress_qs.aggregate(avg=Avg("progress_percent"))["avg"] or 0
    progress_percent = int(round(avg)) if total_parts else 0
    if total_parts and completed >= total_parts:
        progress_percent = 100

    status = _derive_status(progress_percent, completed, total_parts)
    completed_at = timezone.now() if status == ProgressStatus.COMPLETED else None

    obj, _ = ChapterProgress.objects.update_or_create(
        student=student,
        chapter=chapter,
        defaults={
            "status": status,
            "progress_percent": progress_percent,
            "completed_at": completed_at,
        },
    )
    return obj


@transaction.atomic
def recalculate_course_progress(student, course) -> CourseProgress:
    """Recompute course progress from published parts across all chapters."""
    parts_qs = Part.objects.filter(
        chapter__course=course,
        chapter__is_published=True,
        is_published=True,
    )
    total_parts = parts_qs.count()

    progress_qs = StudentProgress.objects.filter(
        student=student,
        course=course,
        part__in=parts_qs,
    )
    completed_parts = progress_qs.filter(status=ProgressStatus.COMPLETED).count()
    avg = progress_qs.aggregate(avg=Avg("progress_percent"))["avg"] or 0
    progress_percent = int(round(avg)) if total_parts else 0
    if total_parts and completed_parts >= total_parts:
        progress_percent = 100

    status = _derive_status(progress_percent, completed_parts, total_parts)

    # Ensure chapter aggregates stay in sync
    for chapter in Chapter.objects.filter(course=course, is_published=True):
        recalculate_chapter_progress(student, chapter)

    obj, _ = CourseProgress.objects.update_or_create(
        student=student,
        course=course,
        defaults={
            "status": status,
            "progress_percent": progress_percent,
            "completed_parts": completed_parts,
            "total_parts": total_parts,
            "last_accessed_at": timezone.now(),
        },
    )
    return obj


@transaction.atomic
def update_student_progress(
    *,
    student,
    part,
    status=None,
    progress_percent=None,
    last_position_seconds=None,
) -> StudentProgress:
    """
    Create or update part progress and cascade chapter/course recalculation.
    """
    defaults = {
        "chapter": part.chapter,
        "course": part.chapter.course,
    }
    progress, created = StudentProgress.objects.get_or_create(
        student=student,
        part=part,
        defaults={
            **defaults,
            "status": ProgressStatus.NOT_STARTED,
            "progress_percent": 0,
        },
    )

    now = timezone.now()
    update_fields = ["updated_at", "chapter", "course"]

    progress.chapter = part.chapter
    progress.course = part.chapter.course

    if created or progress.started_at is None:
        if status and status != ProgressStatus.NOT_STARTED:
            progress.started_at = now
            update_fields.append("started_at")
        elif progress_percent and progress_percent > 0:
            progress.started_at = now
            update_fields.append("started_at")

    if status is not None:
        progress.status = status
        update_fields.append("status")

    if progress_percent is not None:
        progress.progress_percent = max(0, min(100, int(progress_percent)))
        update_fields.append("progress_percent")
        if progress.progress_percent >= 100:
            progress.status = ProgressStatus.COMPLETED
            if "status" not in update_fields:
                update_fields.append("status")

    if last_position_seconds is not None:
        progress.last_position_seconds = max(0, int(last_position_seconds))
        update_fields.append("last_position_seconds")
        if progress.status == ProgressStatus.NOT_STARTED and progress.last_position_seconds > 0:
            progress.status = ProgressStatus.IN_PROGRESS
            if "status" not in update_fields:
                update_fields.append("status")
            if progress.started_at is None:
                progress.started_at = now
                update_fields.append("started_at")

    if progress.status == ProgressStatus.COMPLETED:
        if progress.progress_percent < 100:
            progress.progress_percent = 100
            if "progress_percent" not in update_fields:
                update_fields.append("progress_percent")
        if progress.completed_at is None:
            progress.completed_at = now
            update_fields.append("completed_at")
        if progress.started_at is None:
            progress.started_at = now
            update_fields.append("started_at")
    elif progress.status == ProgressStatus.IN_PROGRESS and progress.started_at is None:
        progress.started_at = now
        update_fields.append("started_at")
        progress.completed_at = None
        update_fields.append("completed_at")
    elif progress.status == ProgressStatus.NOT_STARTED:
        progress.completed_at = None
        update_fields.append("completed_at")

    progress.save(update_fields=list(dict.fromkeys(update_fields)))

    recalculate_course_progress(student, progress.course)
    return progress

"""
Course content CMS models for ShikshaLab.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedModel


class Chapter(TimeStampedModel):
    """Logical chapter / module within a course."""

    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="chapters",
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_published = models.BooleanField(default=False, db_index=True)
    duration_minutes = models.PositiveIntegerField(
        default=0,
        help_text=_("Estimated total duration of this chapter in minutes."),
    )

    class Meta:
        ordering = ["course", "order", "id"]
        verbose_name = _("chapter")
        verbose_name_plural = _("chapters")
        constraints = [
            models.UniqueConstraint(
                fields=["course", "slug"],
                name="unique_chapter_slug_per_course",
            ),
        ]
        indexes = [
            models.Index(fields=["course", "is_published"]),
            models.Index(fields=["course", "order"]),
        ]

    def __str__(self):
        return f"{self.course_id} — {self.title}"


class Part(TimeStampedModel):
    """Lesson / part belonging to a chapter."""

    class ContentType(models.TextChoices):
        VIDEO = "VIDEO", _("Video")
        NOTES = "NOTES", _("Notes")
        PDF = "PDF", _("PDF")
        RESOURCE = "RESOURCE", _("Resource")
        MIXED = "MIXED", _("Mixed")

    chapter = models.ForeignKey(
        Chapter,
        on_delete=models.CASCADE,
        related_name="parts",
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    content_type = models.CharField(
        max_length=20,
        choices=ContentType.choices,
        default=ContentType.MIXED,
        db_index=True,
    )
    video_url = models.URLField(blank=True)
    video_duration_seconds = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    is_preview = models.BooleanField(
        default=False,
        help_text=_("If true, content is visible without enrollment."),
    )
    is_published = models.BooleanField(default=False, db_index=True)
    estimated_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["chapter", "order", "id"]
        verbose_name = _("part")
        verbose_name_plural = _("parts")
        constraints = [
            models.UniqueConstraint(
                fields=["chapter", "slug"],
                name="unique_part_slug_per_chapter",
            ),
        ]
        indexes = [
            models.Index(fields=["chapter", "is_published"]),
            models.Index(fields=["chapter", "order"]),
            models.Index(fields=["content_type"]),
        ]

    def __str__(self):
        return f"{self.chapter_id} — {self.title}"

    @property
    def course(self):
        return self.chapter.course


class PartResource(TimeStampedModel):
    """External or uploaded resource linked to a part."""

    class ResourceType(models.TextChoices):
        PDF = "PDF", _("PDF")
        DOC = "DOC", _("Document")
        LINK = "LINK", _("Link")
        OTHER = "OTHER", _("Other")

    part = models.ForeignKey(
        Part,
        on_delete=models.CASCADE,
        related_name="resources",
    )
    title = models.CharField(max_length=255)
    resource_type = models.CharField(
        max_length=20,
        choices=ResourceType.choices,
        default=ResourceType.OTHER,
    )
    file = models.FileField(
        upload_to="content/resources/%Y/%m/",
        null=True,
        blank=True,
    )
    external_url = models.URLField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["part", "order", "id"]
        verbose_name = _("part resource")
        verbose_name_plural = _("part resources")

    def __str__(self):
        return self.title


class PartAttachment(TimeStampedModel):
    """File attachment for a part."""

    part = models.ForeignKey(
        Part,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="content/attachments/%Y/%m/")
    file_size = models.PositiveBigIntegerField(
        default=0,
        help_text=_("File size in bytes."),
    )
    file_type = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["part", "id"]
        verbose_name = _("part attachment")
        verbose_name_plural = _("part attachments")

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except (ValueError, OSError):
                pass
        if self.file and not self.file_type:
            name = getattr(self.file, "name", "") or ""
            if "." in name:
                self.file_type = name.rsplit(".", 1)[-1].lower()
        super().save(*args, **kwargs)


class ProgressStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", _("Not started")
    IN_PROGRESS = "IN_PROGRESS", _("In progress")
    COMPLETED = "COMPLETED", _("Completed")


class StudentProgress(TimeStampedModel):
    """Per-part learning progress for a student."""

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="part_progress",
    )
    part = models.ForeignKey(
        Part,
        on_delete=models.CASCADE,
        related_name="student_progress",
    )
    chapter = models.ForeignKey(
        Chapter,
        on_delete=models.CASCADE,
        related_name="student_progress",
        null=True,
        blank=True,
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="student_progress",
    )
    status = models.CharField(
        max_length=20,
        choices=ProgressStatus.choices,
        default=ProgressStatus.NOT_STARTED,
        db_index=True,
    )
    progress_percent = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    last_position_seconds = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = _("student progress")
        verbose_name_plural = _("student progress")
        constraints = [
            models.UniqueConstraint(
                fields=["student", "part"],
                name="unique_student_part_progress",
            ),
        ]
        indexes = [
            models.Index(fields=["student", "course"]),
            models.Index(fields=["student", "status"]),
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return f"{self.student_id} / {self.part_id} ({self.status})"

    def save(self, *args, **kwargs):
        if self.part_id and not self.chapter_id:
            self.chapter_id = self.part.chapter_id
        if self.part_id and not self.course_id:
            self.course_id = self.part.chapter.course_id
        super().save(*args, **kwargs)


class ChapterProgress(TimeStampedModel):
    """Aggregated chapter-level progress for a student."""

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="chapter_progress",
    )
    chapter = models.ForeignKey(
        Chapter,
        on_delete=models.CASCADE,
        related_name="chapter_progress",
    )
    status = models.CharField(
        max_length=20,
        choices=ProgressStatus.choices,
        default=ProgressStatus.NOT_STARTED,
        db_index=True,
    )
    progress_percent = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = _("chapter progress")
        verbose_name_plural = _("chapter progress")
        constraints = [
            models.UniqueConstraint(
                fields=["student", "chapter"],
                name="unique_student_chapter_progress",
            ),
        ]

    def __str__(self):
        return f"{self.student_id} / chapter {self.chapter_id} ({self.status})"


class CourseProgress(TimeStampedModel):
    """Aggregated course-level progress for a student."""

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="course_progress",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="course_progress",
    )
    status = models.CharField(
        max_length=20,
        choices=ProgressStatus.choices,
        default=ProgressStatus.NOT_STARTED,
        db_index=True,
    )
    progress_percent = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    completed_parts = models.PositiveIntegerField(default=0)
    total_parts = models.PositiveIntegerField(default=0)
    last_accessed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_accessed_at", "-updated_at"]
        verbose_name = _("course progress")
        verbose_name_plural = _("course progress")
        constraints = [
            models.UniqueConstraint(
                fields=["student", "course"],
                name="unique_student_course_progress",
            ),
        ]
        indexes = [
            models.Index(fields=["student", "status"]),
        ]

    def __str__(self):
        return f"{self.student_id} / course {self.course_id} ({self.progress_percent}%)"

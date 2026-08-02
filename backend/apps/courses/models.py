"""
Course catalog models for ShikshaLab.
"""

from django.conf import settings
from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class CourseCategory(BaseModel):
    """Hierarchical course category."""

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    icon = models.CharField(
        max_length=100,
        blank=True,
        help_text=_("Icon class name or image path identifier."),
    )
    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name = _("course category")
        verbose_name_plural = _("course categories")

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        name_changed = True
        if self.pk:
            previous = (
                CourseCategory.all_objects.filter(pk=self.pk)
                .values_list("name", flat=True)
                .first()
            )
            if previous is not None:
                name_changed = previous != self.name

        if not self.slug or name_changed:
            base = slugify(self.name) or "category"
            slug = base
            counter = 1
            while (
                CourseCategory.all_objects.filter(slug=slug)
                .exclude(pk=self.pk)
                .exists()
            ):
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Course(BaseModel):
    """A course offered by ShikshaLab."""

    class EnrollmentType(models.TextChoices):
        PHYSICAL = "PHYSICAL", _("Physical")
        ONLINE = "ONLINE", _("Online")
        HYBRID = "HYBRID", _("Hybrid")

    class Level(models.TextChoices):
        BEGINNER = "BEGINNER", _("Beginner")
        INTERMEDIATE = "INTERMEDIATE", _("Intermediate")
        ADVANCED = "ADVANCED", _("Advanced")

    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Draft")
        PUBLISHED = "PUBLISHED", _("Published")
        ARCHIVED = "ARCHIVED", _("Archived")

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=270, unique=True)
    categories = models.ManyToManyField(
        CourseCategory,
        related_name="courses",
        blank=True,
    )
    description = models.TextField(blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    duration_weeks = models.PositiveIntegerField(null=True, blank=True)
    duration_hours = models.PositiveIntegerField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    working_days = models.JSONField(
        default=list,
        blank=True,
        help_text=_("List of weekday names, e.g. ['Monday', 'Wednesday']."),
    )
    class_start_time = models.TimeField(null=True, blank=True)
    class_end_time = models.TimeField(null=True, blank=True)
    enrollment_type = models.CharField(
        max_length=20,
        choices=EnrollmentType.choices,
        default=EnrollmentType.PHYSICAL,
        db_index=True,
    )
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.BEGINNER,
        db_index=True,
    )
    max_capacity = models.PositiveIntegerField(null=True, blank=True)
    thumbnail = models.ImageField(
        upload_to="courses/thumbnails/",
        null=True,
        blank=True,
    )
    banner = models.ImageField(
        upload_to="courses/banners/",
        null=True,
        blank=True,
    )
    is_published = models.BooleanField(default=False, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    prerequisites = models.TextField(blank=True)
    learning_outcomes = models.JSONField(
        default=list,
        blank=True,
        help_text=_("List of learning outcome strings."),
    )
    language = models.CharField(max_length=50, blank=True, default="English")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_courses",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("course")
        verbose_name_plural = _("courses")
        indexes = [
            models.Index(fields=["is_published", "status"]),
            models.Index(fields=["level", "enrollment_type"]),
            models.Index(fields=["price"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "course"
            slug = base
            counter = 1
            while Course.all_objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        if self.is_published and self.status == self.Status.DRAFT:
            self.status = self.Status.PUBLISHED
        super().save(*args, **kwargs)


class CourseInstructor(BaseModel):
    """Teacher assigned to instruct a course."""

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="instructors",
    )
    teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.CASCADE,
        related_name="course_assignments",
    )
    is_primary = models.BooleanField(default=False)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_primary", "-assigned_at"]
        verbose_name = _("course instructor")
        verbose_name_plural = _("course instructors")
        constraints = [
            models.UniqueConstraint(
                fields=["course", "teacher"],
                name="unique_course_teacher",
            )
        ]

    def __str__(self):
        role = "primary" if self.is_primary else "instructor"
        return f"{self.teacher} → {self.course} ({role})"


class CourseFAQ(BaseModel):
    """Frequently asked question for a course."""

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="faqs",
    )
    question = models.CharField(max_length=500)
    answer = models.TextField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "created_at"]
        verbose_name = _("course FAQ")
        verbose_name_plural = _("course FAQs")

    def __str__(self):
        return self.question[:80]

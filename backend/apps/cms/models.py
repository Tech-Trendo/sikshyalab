"""
Website CMS models for ShikshaLab public site content.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class SiteSetting(BaseModel):
    """Singleton-ish site-wide settings (use the latest active row)."""

    site_name = models.CharField(max_length=200, default="skillsikshya")
    tagline = models.CharField(max_length=300, blank=True)
    logo = models.ImageField(upload_to="cms/site/", null=True, blank=True)
    favicon = models.ImageField(upload_to="cms/site/", null=True, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    social_links = models.JSONField(default=dict, blank=True)
    footer_text = models.TextField(blank=True)
    features_eyebrow = models.CharField(max_length=100, blank=True, default="")
    features_heading = models.CharField(
        max_length=300,
        blank=True,
        default="",
    )
    homepage_features = models.JSONField(
        default=list,
        blank=True,
        help_text=_(
            "List of feature cards: [{title, description, image}, ...]."
        ),
    )
    testimonials_eyebrow = models.CharField(max_length=100, blank=True, default="")
    testimonials_heading = models.CharField(
        max_length=300,
        blank=True,
        default="",
    )
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("site setting")
        verbose_name_plural = _("site settings")

    def __str__(self):
        return self.site_name

    @classmethod
    def get_solo(cls):
        obj = cls.objects.filter(is_published=True).order_by("-created_at").first()
        if obj is None:
            obj = cls.objects.order_by("-created_at").first()
        return obj


class Banner(BaseModel):
    class Placement(models.TextChoices):
        HOME = "HOME", _("Home")
        ABOUT = "ABOUT", _("About")
        COURSES = "COURSES", _("Courses")
        CUSTOM = "CUSTOM", _("Custom")

    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=500, blank=True)
    image = models.ImageField(upload_to="cms/banners/")
    mobile_image = models.ImageField(
        upload_to="cms/banners/mobile/",
        null=True,
        blank=True,
    )
    cta_text = models.CharField(max_length=100, blank=True)
    cta_url = models.CharField(max_length=500, blank=True)
    placement = models.CharField(
        max_length=20,
        choices=Placement.choices,
        default=Placement.HOME,
        db_index=True,
    )
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    is_published = models.BooleanField(default=True, db_index=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = _("banner")
        verbose_name_plural = _("banners")
        indexes = [
            models.Index(fields=["placement", "is_active", "order"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.placement})"

    def is_currently_active(self) -> bool:
        if not self.is_active or not self.is_published:
            return False
        now = timezone.now()
        if self.start_date and now < self.start_date:
            return False
        if self.end_date and now > self.end_date:
            return False
        return True


class Page(BaseModel):
    class PageType(models.TextChoices):
        HOME = "HOME", _("Home")
        ABOUT = "ABOUT", _("About")
        CONTACT = "CONTACT", _("Contact")
        CUSTOM = "CUSTOM", _("Custom")

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=270, unique=True)
    content = models.TextField(blank=True)
    page_type = models.CharField(
        max_length=20,
        choices=PageType.choices,
        default=PageType.CUSTOM,
        db_index=True,
    )
    is_published = models.BooleanField(default=False, db_index=True)
    featured_image = models.ImageField(
        upload_to="cms/pages/",
        null=True,
        blank=True,
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "title"]
        verbose_name = _("page")
        verbose_name_plural = _("pages")

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "page"
            slug = base
            counter = 1
            while Page.all_objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class BlogPost(BaseModel):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=270, unique=True)
    excerpt = models.TextField(blank=True)
    content = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="blog_posts",
    )
    cover_image = models.ImageField(
        upload_to="cms/blog/",
        null=True,
        blank=True,
    )
    category = models.CharField(max_length=100, blank=True, db_index=True)
    tags = models.JSONField(default=list, blank=True)
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    views_count = models.PositiveIntegerField(default=0)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-published_at", "-created_at"]
        verbose_name = _("blog post")
        verbose_name_plural = _("blog posts")
        indexes = [
            models.Index(fields=["is_published", "-published_at"]),
            models.Index(fields=["category"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "post"
            slug = base
            counter = 1
            while BlogPost.all_objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)


class Event(BaseModel):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=270, unique=True)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    start_datetime = models.DateTimeField(db_index=True)
    end_datetime = models.DateTimeField(null=True, blank=True)
    cover_image = models.ImageField(
        upload_to="cms/events/",
        null=True,
        blank=True,
    )
    is_published = models.BooleanField(default=False, db_index=True)
    registration_url = models.URLField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["start_datetime"]
        verbose_name = _("event")
        verbose_name_plural = _("events")
        indexes = [
            models.Index(fields=["is_published", "start_datetime"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "event"
            slug = base
            counter = 1
            while Event.all_objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class EventRegistration(BaseModel):
    """Public event registration — admin approves, then details are emailed."""

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        APPROVED = "APPROVED", _("Approved")
        REJECTED = "REJECTED", _("Rejected")

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    name = models.CharField(max_length=150)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=30, blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    details_emailed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("event registration")
        verbose_name_plural = _("event registrations")
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["event", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["event", "email"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_event_registration_email",
            ),
        ]

    def __str__(self):
        return f"{self.name} → {self.event.title} ({self.status})"


class GalleryItem(BaseModel):
    title = models.CharField(max_length=255)
    image = models.ImageField(upload_to="cms/gallery/")
    category = models.CharField(max_length=100, blank=True, db_index=True)
    event = models.ForeignKey(
        Event,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="gallery_items",
    )
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = _("gallery item")
        verbose_name_plural = _("gallery items")
        indexes = [
            models.Index(fields=["is_published", "order"]),
            models.Index(fields=["event", "is_published"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # Keep category in sync with linked event title for legacy filters/UI.
        if self.event_id and not self.category:
            self.category = self.event.title[:100]
        super().save(*args, **kwargs)


class Partner(BaseModel):
    """Partner / brand logo shown on the public homepage."""

    name = models.CharField(max_length=200, blank=True)
    logo = models.ImageField(upload_to="cms/partners/")
    website_url = models.URLField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = _("partner")
        verbose_name_plural = _("partners")

    def __str__(self):
        return self.name or f"Partner {self.pk}"


class Testimonial(BaseModel):
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=150, blank=True)
    organization = models.CharField(max_length=200, blank=True)
    content = models.TextField()
    avatar = models.ImageField(
        upload_to="cms/testimonials/",
        null=True,
        blank=True,
    )
    rating = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    is_featured = models.BooleanField(default=False, db_index=True)
    is_published = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "-is_featured", "-created_at"]
        verbose_name = _("testimonial")
        verbose_name_plural = _("testimonials")

    def __str__(self):
        return f"{self.name} ({self.rating}/5)"


class CourseReview(BaseModel):
    """Student-submitted course review; can be promoted to a public testimonial."""

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        APPROVED = "APPROVED", _("Approved")
        REJECTED = "REJECTED", _("Rejected")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="course_reviews",
    )
    student_name = models.CharField(max_length=150)
    student_email = models.EmailField(blank=True)
    course_name = models.CharField(max_length=255)
    rating = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    content = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    testimonial = models.OneToOneField(
        Testimonial,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="course_review",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("course review")
        verbose_name_plural = _("course reviews")
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["course_name"]),
        ]

    def __str__(self):
        return f"{self.student_name} — {self.course_name} ({self.rating}/5)"


class FAQ(BaseModel):
    question = models.CharField(max_length=500)
    answer = models.TextField()
    category = models.CharField(max_length=100, blank=True, db_index=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["order", "question"]
        verbose_name = _("FAQ")
        verbose_name_plural = _("FAQs")

    def __str__(self):
        return self.question[:80]


class Career(BaseModel):
    class EmploymentType(models.TextChoices):
        FULL_TIME = "FULL_TIME", _("Full Time")
        PART_TIME = "PART_TIME", _("Part Time")
        CONTRACT = "CONTRACT", _("Contract")
        INTERNSHIP = "INTERNSHIP", _("Internship")
        REMOTE = "REMOTE", _("Remote")

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=270, unique=True)
    department = models.CharField(max_length=150, blank=True)
    location = models.CharField(max_length=200, blank=True)
    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.FULL_TIME,
        db_index=True,
    )
    description = models.TextField()
    requirements = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_published = models.BooleanField(default=True, db_index=True)
    posted_at = models.DateTimeField(default=timezone.now)
    closes_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-posted_at"]
        verbose_name = _("career")
        verbose_name_plural = _("careers")
        indexes = [
            models.Index(fields=["is_active", "is_published", "-posted_at"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "career"
            slug = base
            counter = 1
            while Career.all_objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Announcement(BaseModel):
    class Priority(models.TextChoices):
        LOW = "LOW", _("Low")
        MEDIUM = "MEDIUM", _("Medium")
        HIGH = "HIGH", _("High")

    class Audience(models.TextChoices):
        ALL = "ALL", _("All")
        STUDENTS = "STUDENTS", _("Students")
        TEACHERS = "TEACHERS", _("Teachers")
        ADMIN = "ADMIN", _("Admin")

    title = models.CharField(max_length=255)
    content = models.TextField()
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    audience = models.CharField(
        max_length=20,
        choices=Audience.choices,
        default=Audience.ALL,
        db_index=True,
    )
    is_published = models.BooleanField(default=False, db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-priority", "-created_at"]
        verbose_name = _("announcement")
        verbose_name_plural = _("announcements")
        indexes = [
            models.Index(fields=["is_published", "audience", "priority"]),
        ]

    def __str__(self):
        return self.title

    def is_currently_active(self) -> bool:
        if not self.is_published:
            return False
        now = timezone.now()
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        return True


class ContactMessage(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        CONTACTED = "CONTACTED", _("Contacted")
        CONVERTED = "CONVERTED", _("Converted")
        LOST = "LOST", _("Lost")

    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    is_read = models.BooleanField(default=False, db_index=True)
    replied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("contact message")
        verbose_name_plural = _("contact messages")
        indexes = [
            models.Index(fields=["is_read", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.subject} — {self.email}"

    def apply_status(self, status: str) -> None:
        """Set CRM status and keep is_read / replied_at in sync."""
        status = (status or "").upper()
        if status not in self.Status.values:
            raise ValueError(f"Invalid status: {status}")
        self.status = status
        self.is_read = status != self.Status.PENDING
        if status == self.Status.PENDING:
            self.replied_at = None
        elif status == self.Status.CONTACTED and self.replied_at is None:
            self.replied_at = timezone.now()
        elif status in (self.Status.CONVERTED, self.Status.LOST) and self.replied_at is None:
            self.replied_at = timezone.now()


class CMSTeacherHighlight(BaseModel):
    """Optional featured teachers for the public website."""

    teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.CASCADE,
        related_name="cms_highlights",
    )
    order = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=True, db_index=True)
    is_published = models.BooleanField(default=True, db_index=True)
    blurb = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["order", "-is_featured"]
        verbose_name = _("CMS teacher highlight")
        verbose_name_plural = _("CMS teacher highlights")
        constraints = [
            models.UniqueConstraint(
                fields=["teacher"],
                name="unique_cms_teacher_highlight",
            ),
        ]

    def __str__(self):
        return f"Highlight: {self.teacher}"

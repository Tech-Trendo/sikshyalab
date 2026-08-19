"""
SEO metadata, sitemap entries, and redirect rules.
"""

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class SEOMetadata(BaseModel):
    """Per-object SEO metadata via GenericForeignKey."""

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="seo_metadata",
    )
    object_id = models.CharField(max_length=64, db_index=True)
    content_object = GenericForeignKey("content_type", "object_id")

    meta_title = models.CharField(max_length=70, blank=True)
    meta_description = models.CharField(max_length=320, blank=True)
    meta_keywords = models.CharField(max_length=500, blank=True)
    slug = models.SlugField(max_length=270, blank=True, db_index=True)
    canonical_url = models.URLField(blank=True)

    og_title = models.CharField(max_length=100, blank=True, help_text=_("Recommended: 60 characters max."))
    og_description = models.CharField(
        max_length=320,
        blank=True,
        help_text=_("Recommended: 160 characters max."),
    )
    og_image = models.ImageField(
        upload_to="seo/og/",
        null=True,
        blank=True,
        help_text=_("Recommended image size: 1200×630px."),
    )
    og_type = models.CharField(max_length=50, blank=True, default="website")

    twitter_card = models.CharField(
        max_length=50,
        blank=True,
        default="summary_large_image",
    )
    twitter_title = models.CharField(max_length=100, blank=True)
    twitter_description = models.CharField(max_length=320, blank=True)
    twitter_image = models.ImageField(
        upload_to="seo/twitter/",
        null=True,
        blank=True,
    )

    robots = models.CharField(
        max_length=100,
        blank=True,
        default="index,follow",
        help_text=_("e.g. index,follow or noindex,nofollow"),
    )
    structured_data = models.JSONField(default=dict, blank=True)
    focus_keyword = models.CharField(max_length=100, blank=True)
    seo_score = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    is_indexed = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = _("SEO metadata")
        verbose_name_plural = _("SEO metadata")
        constraints = [
            models.UniqueConstraint(
                fields=["content_type", "object_id"],
                name="unique_seo_metadata_per_object",
            ),
        ]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["is_indexed", "seo_score"]),
            models.Index(fields=["canonical_url"]),
            models.Index(fields=["is_indexed", "canonical_url"]),
        ]

    def __str__(self):
        return self.meta_title or f"SEO for {self.content_type} #{self.object_id}"


class SitemapEntry(BaseModel):
    class ChangeFreq(models.TextChoices):
        ALWAYS = "always", _("Always")
        HOURLY = "hourly", _("Hourly")
        DAILY = "daily", _("Daily")
        WEEKLY = "weekly", _("Weekly")
        MONTHLY = "monthly", _("Monthly")
        YEARLY = "yearly", _("Yearly")
        NEVER = "never", _("Never")

    class PageType(models.TextChoices):
        PAGE = "page", _("Page")
        COURSE = "course", _("Course")
        BLOG = "blog", _("Blog")
        EVENT = "event", _("Event")
        CATEGORY = "category", _("Category")
        CUSTOM = "custom", _("Custom")

    title = models.CharField(max_length=255, blank=True, default="")
    slug = models.CharField(
        max_length=270,
        unique=True,
        db_index=True,
        help_text=_("Unique page key used in /api/sitemap/<slug>/. Homepage uses 'home'."),
    )
    url_path = models.CharField(max_length=500, unique=True, db_index=True)
    page_type = models.CharField(
        max_length=20,
        choices=PageType.choices,
        default=PageType.PAGE,
        db_index=True,
    )
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
        db_index=True,
    )
    is_published = models.BooleanField(default=True, db_index=True)
    is_indexable = models.BooleanField(default=True, db_index=True)
    # Kept in sync with is_published for existing Next.js /seo/sitemap/ consumers.
    is_active = models.BooleanField(default=True, db_index=True)
    changefreq = models.CharField(
        max_length=20,
        choices=ChangeFreq.choices,
        default=ChangeFreq.WEEKLY,
    )
    priority = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    lastmod = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ["order", "-priority", "url_path"]
        verbose_name = _("sitemap entry")
        verbose_name_plural = _("sitemap entries")
        indexes = [
            models.Index(fields=["is_published", "is_indexable"]),
            models.Index(fields=["parent", "order"]),
            models.Index(fields=["updated_at"]),
            models.Index(fields=["page_type", "is_published"]),
        ]

    def __str__(self):
        return self.title or self.url_path

    def clean(self):
        from django.core.exceptions import ValidationError

        from apps.seo.sitemap_utils import normalize_url_path, slug_from_path, would_create_cycle

        try:
            self.url_path = normalize_url_path(self.url_path)
        except ValueError as exc:
            raise ValidationError({"url_path": str(exc)}) from exc
        if not self.slug:
            self.slug = slug_from_path(self.url_path)
        self.slug = (self.slug or "").strip().strip("/") or "home"

        if self.parent_id:
            if self.pk and self.parent_id == self.pk:
                raise ValidationError({"parent": "A page cannot be its own parent."})
            if would_create_cycle(self, self.parent):
                raise ValidationError(
                    {"parent": "Parent cannot create a circular relationship."}
                )

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        from django.utils import timezone

        from apps.seo.sitemap_utils import infer_page_type, normalize_url_path, slug_from_path

        try:
            self.url_path = normalize_url_path(self.url_path)
        except ValueError as exc:
            raise ValidationError({"url_path": str(exc)}) from exc
        if not self.slug:
            self.slug = slug_from_path(self.url_path)
        self.slug = (self.slug or "").strip().strip("/") or "home"
        if not self.title:
            self.title = "Home" if self.slug == "home" else self.slug.replace("-", " ").title()
        if not self.page_type:
            self.page_type = infer_page_type(self.url_path)
        self.is_active = bool(self.is_published)
        self.lastmod = timezone.now()
        super().save(*args, **kwargs)


class RedirectRule(BaseModel):
    class StatusCode(models.IntegerChoices):
        PERMANENT = 301, _("301 Permanent")
        TEMPORARY = 302, _("302 Temporary")

    from_path = models.CharField(max_length=500, unique=True, db_index=True)
    to_path = models.CharField(max_length=500)
    status_code = models.PositiveSmallIntegerField(
        choices=StatusCode.choices,
        default=StatusCode.PERMANENT,
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["from_path"]
        verbose_name = _("redirect rule")
        verbose_name_plural = _("redirect rules")

    def __str__(self):
        return f"{self.from_path} → {self.to_path} ({self.status_code})"

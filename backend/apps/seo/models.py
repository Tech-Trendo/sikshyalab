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

    og_title = models.CharField(max_length=100, blank=True)
    og_description = models.CharField(max_length=320, blank=True)
    og_image = models.ImageField(upload_to="seo/og/", null=True, blank=True)
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

    url_path = models.CharField(max_length=500, unique=True, db_index=True)
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
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-priority", "url_path"]
        verbose_name = _("sitemap entry")
        verbose_name_plural = _("sitemap entries")

    def __str__(self):
        return self.url_path


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

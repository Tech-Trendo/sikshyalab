from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class Video(BaseModel):
    class Status(models.TextChoices):
        UPLOADING = "UPLOADING"
        PROCESSING = "PROCESSING"
        COMPLETED = "COMPLETED"
        FAILED = "FAILED"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="videos")
    original_filename = models.CharField(max_length=255)
    original_size = models.BigIntegerField()
    compressed_size = models.BigIntegerField(null=True, blank=True)
    compression_percentage = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    original_s3_key = models.CharField(max_length=1024, blank=True, default="")
    compressed_s3_key = models.CharField(max_length=1024, blank=True, default="")
    duration = models.FloatField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    fps = models.FloatField(null=True, blank=True)
    codec = models.CharField(max_length=128, blank=True, default="")
    bitrate = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADING, db_index=True)
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    @property
    def compression_ratio(self):
        if not self.original_size or not self.compressed_size:
            return None
        return round((1 - (self.compressed_size / self.original_size)) * 100, 2)

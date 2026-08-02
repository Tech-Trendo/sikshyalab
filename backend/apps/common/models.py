"""
Shared abstract base models for ShikshaLab.
"""

import uuid

from django.db import models
from django.utils import timezone

from apps.common.mixins import SoftDeleteManager


class TimeStampedModel(models.Model):
    """Abstract model that tracks creation and last-update timestamps."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class SoftDeleteModel(models.Model):
    """
    Abstract model providing soft-delete behaviour.

    Records are marked deleted instead of being removed from the database.
    Use ``.objects`` for active rows and ``.all_objects`` for the full set.
    """

    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False, hard=False):
        if hard:
            return super().delete(using=using, keep_parents=keep_parents)
        self.is_deleted = True
        self.deleted_at = timezone.now()
        update_fields = ["is_deleted", "deleted_at"]
        if hasattr(self, "updated_at"):
            update_fields.append("updated_at")
        self.save(update_fields=update_fields)

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        update_fields = ["is_deleted", "deleted_at"]
        if hasattr(self, "updated_at"):
            update_fields.append("updated_at")
        self.save(update_fields=update_fields)


class UUIDPrimaryKeyModel(models.Model):
    """Abstract model using a UUID as the primary key."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        unique=True,
    )

    class Meta:
        abstract = True


class BaseModel(UUIDPrimaryKeyModel, TimeStampedModel, SoftDeleteModel):
    """
    Convenience base combining UUID PK, timestamps, and soft-delete.
    Prefer this for most domain models.
    """

    class Meta:
        abstract = True
        ordering = ["-created_at"]

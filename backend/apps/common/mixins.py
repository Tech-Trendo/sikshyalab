"""
QuerySet / Manager mixins for soft-delete support.
"""

from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    """QuerySet that soft-deletes by default and exposes restore helpers."""

    def delete(self, hard=False):
        if hard:
            return super().delete()
        return super().update(is_deleted=True, deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)

    def restore(self):
        return super().update(is_deleted=False, deleted_at=None)


class SoftDeleteManager(models.Manager):
    """Manager that returns only non-deleted rows by default."""

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)

    def alive(self):
        return self.get_queryset()

    def dead(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=True)

    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

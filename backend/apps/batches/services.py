"""
Helpers for batch enrollment counts.
"""

from django.db import transaction

from apps.batches.models import Batch, BatchStudent


@transaction.atomic
def refresh_batch_enrolled_count(batch: Batch) -> int:
    """Recount ACTIVE members and persist on the batch."""
    count = BatchStudent.objects.filter(
        batch=batch,
        status=BatchStudent.Status.ACTIVE,
    ).count()
    Batch.objects.filter(pk=batch.pk).update(enrolled_count=count)
    batch.enrolled_count = count
    return count


@transaction.atomic
def add_student_to_batch(*, batch: Batch, student, notes: str = "") -> BatchStudent:
    """Add or reactivate a student in a batch and refresh enrolled_count."""
    membership, created = BatchStudent.objects.get_or_create(
        batch=batch,
        student=student,
        defaults={
            "status": BatchStudent.Status.ACTIVE,
            "notes": notes,
        },
    )
    if not created and membership.status != BatchStudent.Status.ACTIVE:
        membership.status = BatchStudent.Status.ACTIVE
        if notes:
            membership.notes = notes
        membership.save(update_fields=["status", "notes", "updated_at"])
    refresh_batch_enrolled_count(batch)
    return membership


@transaction.atomic
def drop_student_from_batch(*, batch: Batch, student, notes: str = "") -> BatchStudent | None:
    """Mark membership as DROPPED and refresh enrolled_count."""
    try:
        membership = BatchStudent.objects.get(batch=batch, student=student)
    except BatchStudent.DoesNotExist:
        return None
    membership.status = BatchStudent.Status.DROPPED
    if notes:
        membership.notes = notes
    membership.save(update_fields=["status", "notes", "updated_at"])
    refresh_batch_enrolled_count(batch)
    return membership

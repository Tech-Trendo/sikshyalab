"""Student account activation / deactivation helpers."""

from __future__ import annotations

import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone

from apps.students.models import Student, StudentActivityLog

logger = logging.getLogger(__name__)

ACCOUNT_DEACTIVATED_MESSAGE = (
    "Your account has been deactivated. Please contact the administrator."
)


def get_student_profile(user):
    if user is None:
        return None
    try:
        return user.student_profile
    except ObjectDoesNotExist:
        return None


def is_student_inactive(user) -> bool:
    """Return True when the user has an INACTIVE student profile."""
    student = get_student_profile(user)
    return bool(student and student.status == Student.Status.INACTIVE)


def blacklist_user_tokens(user) -> int:
    """Blacklist all outstanding JWT refresh tokens for the user."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )
    except Exception:
        logger.warning("JWT blacklist unavailable; skipping token invalidation.")
        return 0

    count = 0
    for token in OutstandingToken.objects.filter(user_id=user.pk):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            count += 1
    return count


def sync_user_login_flags(user, *, allow_login: bool) -> None:
    updates: list[str] = []
    if user.is_active != allow_login:
        user.is_active = allow_login
        updates.append("is_active")
    if user.is_active_account != allow_login:
        user.is_active_account = allow_login
        updates.append("is_active_account")
    if updates:
        updates.append("updated_at")
        user.save(update_fields=list(dict.fromkeys(updates)))


@transaction.atomic
def deactivate_student(student: Student, *, performed_by=None) -> Student:
    """
    Mark student INACTIVE, record audit fields, disable login, and revoke JWTs.
    """
    actor = performed_by if performed_by and getattr(performed_by, "is_authenticated", False) else None

    student.status = Student.Status.INACTIVE
    student.deactivated_at = timezone.now()
    student.deactivated_by = actor
    student.save(
        update_fields=[
            "status",
            "deactivated_at",
            "deactivated_by",
            "updated_at",
        ]
    )

    sync_user_login_flags(student.user, allow_login=False)
    blacklist_user_tokens(student.user)

    StudentActivityLog.objects.create(
        student=student,
        action="student.deactivated",
        description="Student account deactivated.",
        performed_by=actor,
        metadata={
            "deactivated_at": student.deactivated_at.isoformat() if student.deactivated_at else None,
            "deactivated_by": str(student.deactivated_by_id) if student.deactivated_by_id else None,
        },
    )

    try:
        from apps.accounts.emails import send_student_deactivated_email

        send_student_deactivated_email(
            email=student.user.email,
            name=student.user.get_full_name(),
        )
    except Exception:
        logger.exception("Failed to send student deactivation email to %s", student.user.email)

    return student


@transaction.atomic
def reactivate_student(student: Student, *, performed_by=None) -> Student:
    """Mark student ACTIVE, clear audit fields, and restore login."""
    actor = performed_by if performed_by and getattr(performed_by, "is_authenticated", False) else None

    student.status = Student.Status.ACTIVE
    student.deactivated_at = None
    student.deactivated_by = None
    student.save(
        update_fields=[
            "status",
            "deactivated_at",
            "deactivated_by",
            "updated_at",
        ]
    )

    sync_user_login_flags(student.user, allow_login=True)

    StudentActivityLog.objects.create(
        student=student,
        action="student.reactivated",
        description="Student account reactivated.",
        performed_by=actor,
    )

    try:
        from apps.accounts.emails import send_student_reactivated_email

        send_student_reactivated_email(
            email=student.user.email,
            name=student.user.get_full_name(),
        )
    except Exception:
        logger.exception("Failed to send student reactivation email to %s", student.user.email)

    return student

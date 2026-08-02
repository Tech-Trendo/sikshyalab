"""
Role-aware dashboard KPIs matching the frontend dashboard overviews.

Admin   → platform-wide stats (students, batches, courses, revenue, …)
Teacher → assigned courses/batches/students, pending reviews, open portals
Student → enrolled courses, open assignments, tasks, certificates, fees
"""

from __future__ import annotations

import logging
from calendar import monthrange
from datetime import datetime, timedelta
from decimal import Decimal

from django.apps import apps
from django.db import OperationalError, ProgrammingError
from django.db.models import Count, Q, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)

_DB_MISSING = (OperationalError, ProgrammingError, LookupError)

def _get_model(label: str):
    try:
        return apps.get_model(label)
    except LookupError:
        return None
    except Exception:
        logger.debug("Failed to load model %s", label, exc_info=True)
        return None


def _safe_count(model, **filters) -> int:
    if model is None:
        return 0
    try:
        qs = model.objects.all()
        if hasattr(model, "is_deleted"):
            qs = qs.filter(is_deleted=False)
        if filters:
            qs = qs.filter(**filters)
        return qs.count()
    except _DB_MISSING:
        return 0
    except Exception:
        logger.debug("safe_count failed for %s", model, exc_info=True)
        return 0


def _month_start(dt=None):
    dt = dt or timezone.now()
    if timezone.is_aware(dt):
        dt = timezone.localtime(dt)
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _iter_months(months: int):
    now = timezone.localtime(timezone.now())
    year, month = now.year, now.month
    results = []
    for _ in range(months):
        start = timezone.make_aware(datetime(year, month, 1))
        last_day = monthrange(year, month)[1]
        end = timezone.make_aware(datetime(year, month, last_day, 23, 59, 59, 999999))
        results.append((year, month, start, end))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    results.reverse()
    return results


def _resolve_role(user) -> str:
    from apps.common.permissions import (
        ROLE_ADMIN,
        ROLE_STAFF,
        ROLE_STUDENT,
        ROLE_TEACHER,
        user_has_role,
    )

    if user is None or not getattr(user, "is_authenticated", False):
        return "admin"
    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        return "admin"
    if user_has_role(user, ROLE_TEACHER):
        return "teacher"
    if user_has_role(user, ROLE_STUDENT):
        return "student"
    return "admin"


def teacher_scope_filters(user):
    """
    Return a dict of related filter helpers for teacher-scoped queries.
    Returns None for admin (no restriction). Empty dict means no teacher profile.
    """
    from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, user_has_role

    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        return None

    if not user_has_role(user, ROLE_TEACHER):
        return {}

    Teacher = _get_model("teachers.Teacher")
    if Teacher is None:
        return {}
    try:
        teacher = Teacher.objects.filter(user=user).first()
    except Exception:
        return {}
    if teacher is None:
        return {}
    return {"teacher": teacher}


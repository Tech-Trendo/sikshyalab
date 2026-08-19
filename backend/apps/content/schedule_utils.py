"""Upcoming class-schedule query and grouping helpers."""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, user_has_role
from apps.content.permissions import user_teaches_course
from apps.content.serializers import ClassScheduleSerializer


def can_manage_course_content(user, course) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        return True
    if user_has_role(user, ROLE_TEACHER):
        return user_teaches_course(user, course)
    return False


def upcoming_class_schedules_qs(course, user=None, *, public_only=False):
    from apps.content.models import ClassSchedule

    today = timezone.localdate()
    now_time = timezone.localtime().time()
    qs = (
        ClassSchedule.objects.filter(course=course)
        .filter(Q(date__gt=today) | Q(date=today, end_time__gte=now_time))
        .order_by("date", "start_time", "id")
    )
    if public_only or not can_manage_course_content(user, course):
        return qs.filter(is_published=True)
    return qs


def group_class_schedules(schedules) -> list[dict]:
    grouped: list[dict] = []
    current = None
    for row in ClassScheduleSerializer(schedules, many=True).data:
        date = row["date"]
        if current is None or current["date"] != date:
            current = {"date": date, "slots": []}
            grouped.append(current)
        current["slots"].append(row)
    return grouped

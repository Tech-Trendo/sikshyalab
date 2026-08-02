"""
Django filters for batches API.
"""

import django_filters

from apps.batches.models import Batch, BatchSchedule, BatchStudent, Shift


class ShiftFilter(django_filters.FilterSet):
    is_active = django_filters.BooleanFilter()
    code = django_filters.CharFilter(lookup_expr="iexact")
    name = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Shift
        fields = ["is_active", "code"]


class BatchFilter(django_filters.FilterSet):
    course = django_filters.UUIDFilter(field_name="course_id")
    shift = django_filters.NumberFilter(field_name="shift_id")
    teacher = django_filters.UUIDFilter(field_name="teacher_id")
    status = django_filters.CharFilter()
    code = django_filters.CharFilter(lookup_expr="iexact")
    start_date = django_filters.DateFilter(field_name="start_date", lookup_expr="gte")
    end_date = django_filters.DateFilter(field_name="end_date", lookup_expr="lte")

    class Meta:
        model = Batch
        fields = ["course", "shift", "teacher", "status", "code"]


class BatchStudentFilter(django_filters.FilterSet):
    batch = django_filters.UUIDFilter(field_name="batch_id")
    student = django_filters.UUIDFilter(field_name="student_id")
    status = django_filters.CharFilter()

    class Meta:
        model = BatchStudent
        fields = ["batch", "student", "status"]


class BatchScheduleFilter(django_filters.FilterSet):
    batch = django_filters.UUIDFilter(field_name="batch_id")
    day_of_week = django_filters.NumberFilter()
    is_cancelled = django_filters.BooleanFilter()

    class Meta:
        model = BatchSchedule
        fields = ["batch", "day_of_week", "is_cancelled"]

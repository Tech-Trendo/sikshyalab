"""
django-filter FilterSets for the teachers app.
"""

import django_filters

from apps.teachers.models import (
    Teacher,
    TeacherDocument,
    TeacherQualification,
    TeacherSchedule,
    TeacherWorkload,
)


class TeacherFilter(django_filters.FilterSet):
    years_of_experience_min = django_filters.NumberFilter(
        field_name="years_of_experience",
        lookup_expr="gte",
    )
    years_of_experience_max = django_filters.NumberFilter(
        field_name="years_of_experience",
        lookup_expr="lte",
    )

    class Meta:
        model = Teacher
        fields = {
            "status": ["exact"],
            "department": ["exact", "icontains"],
            "designation": ["exact", "icontains"],
            "teacher_id": ["exact", "icontains"],
            "employee_id": ["exact", "icontains"],
            "user": ["exact"],
        }


class TeacherQualificationFilter(django_filters.FilterSet):
    class Meta:
        model = TeacherQualification
        fields = {
            "teacher": ["exact"],
            "degree": ["icontains"],
            "institution": ["icontains"],
            "year": ["exact"],
        }


class TeacherDocumentFilter(django_filters.FilterSet):
    class Meta:
        model = TeacherDocument
        fields = {
            "teacher": ["exact"],
            "doc_type": ["exact"],
        }


class TeacherScheduleFilter(django_filters.FilterSet):
    class Meta:
        model = TeacherSchedule
        fields = {
            "teacher": ["exact"],
            "day_of_week": ["exact"],
            "course": ["exact"],
            "batch": ["exact"],
        }


class TeacherWorkloadFilter(django_filters.FilterSet):
    class Meta:
        model = TeacherWorkload
        fields = {
            "teacher": ["exact"],
            "month": ["exact"],
            "year": ["exact"],
        }

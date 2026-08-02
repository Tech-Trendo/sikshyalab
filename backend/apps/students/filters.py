"""
django-filter FilterSets for the students app.
"""

import django_filters

from apps.students.models import AcademicHistory, Guardian, Student, StudentDocument


class StudentFilter(django_filters.FilterSet):
    admission_date_from = django_filters.DateFilter(
        field_name="admission_date",
        lookup_expr="gte",
    )
    admission_date_to = django_filters.DateFilter(
        field_name="admission_date",
        lookup_expr="lte",
    )
    profile_completed = django_filters.BooleanFilter()

    class Meta:
        model = Student
        fields = {
            "status": ["exact"],
            "blood_group": ["exact"],
            "nationality": ["exact", "icontains"],
            "city": ["exact", "icontains"],
            "district": ["exact", "icontains"],
            "province": ["exact", "icontains"],
            "country": ["exact", "icontains"],
            "student_id": ["exact", "icontains"],
            "enrollment_number": ["exact", "icontains"],
            "user": ["exact"],
        }


class GuardianFilter(django_filters.FilterSet):
    class Meta:
        model = Guardian
        fields = {
            "student": ["exact"],
            "relationship": ["exact"],
            "is_primary": ["exact"],
        }


class AcademicHistoryFilter(django_filters.FilterSet):
    class Meta:
        model = AcademicHistory
        fields = {
            "student": ["exact"],
            "institution": ["icontains"],
            "degree_level": ["exact", "icontains"],
        }


class StudentDocumentFilter(django_filters.FilterSet):
    class Meta:
        model = StudentDocument
        fields = {
            "student": ["exact"],
            "doc_type": ["exact"],
        }

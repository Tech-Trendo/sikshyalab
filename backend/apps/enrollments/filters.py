"""
Django filters for enrollments API.
"""

import django_filters

from apps.enrollments.models import Enrollment, EnrollmentDocument, EnrollmentHistory


class EnrollmentFilter(django_filters.FilterSet):
    student = django_filters.UUIDFilter(field_name="student_id")
    course = django_filters.UUIDFilter(field_name="course_id")
    batch = django_filters.UUIDFilter(field_name="batch_id")
    shift = django_filters.UUIDFilter(field_name="shift_id")
    status = django_filters.CharFilter()
    payment_status = django_filters.CharFilter()
    enrollment_type = django_filters.CharFilter()
    enrollment_number = django_filters.CharFilter(lookup_expr="iexact")

    class Meta:
        model = Enrollment
        fields = [
            "student",
            "course",
            "batch",
            "shift",
            "status",
            "payment_status",
            "enrollment_type",
            "enrollment_number",
        ]


class EnrollmentHistoryFilter(django_filters.FilterSet):
    enrollment = django_filters.NumberFilter(field_name="enrollment_id")
    to_status = django_filters.CharFilter()
    from_status = django_filters.CharFilter()

    class Meta:
        model = EnrollmentHistory
        fields = ["enrollment", "from_status", "to_status"]


class EnrollmentDocumentFilter(django_filters.FilterSet):
    enrollment = django_filters.NumberFilter(field_name="enrollment_id")
    doc_type = django_filters.CharFilter()

    class Meta:
        model = EnrollmentDocument
        fields = ["enrollment", "doc_type"]

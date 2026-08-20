"""
django-filter FilterSets for the courses app.
"""

import django_filters

from apps.courses.models import Course, CourseCategory, CourseInstructor


class CourseCategoryFilter(django_filters.FilterSet):
    class Meta:
        model = CourseCategory
        fields = {
            "parent": ["exact", "isnull"],
            "is_active": ["exact"],
            "slug": ["exact"],
        }


class CourseFilter(django_filters.FilterSet):
    price_min = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    price_max = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    category = django_filters.UUIDFilter(field_name="categories")
    category_slug = django_filters.CharFilter(field_name="categories__slug")

    class Meta:
        model = Course
        fields = {
            "level": ["exact"],
            "enrollment_type": ["exact"],
            "is_published": ["exact"],
            "is_featured": ["exact"],
            "status": ["exact"],
            "language": ["exact", "icontains"],
            "created_by": ["exact"],
        }


class CourseInstructorFilter(django_filters.FilterSet):
    class Meta:
        model = CourseInstructor
        fields = {
            "course": ["exact"],
            "teacher": ["exact"],
            "is_primary": ["exact"],
        }


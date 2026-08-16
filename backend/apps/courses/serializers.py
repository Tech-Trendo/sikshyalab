"""
Serializers for the courses app.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.common.serializers_media import SafeMediaRepresentationMixin
from apps.courses.models import Course, CourseCategory, CourseFAQ, CourseInstructor
from apps.teachers.models import Teacher

User = get_user_model()


class CourseCategorySerializer(serializers.ModelSerializer):
    children_count = serializers.SerializerMethodField()
    course_count = serializers.SerializerMethodField()

    class Meta:
        model = CourseCategory
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "parent",
            "icon",
            "is_active",
            "order",
            "children_count",
            "course_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "children_count",
            "course_count",
            "created_at",
            "updated_at",
        ]

    def get_children_count(self, obj):
        return obj.children.count()

    def get_course_count(self, obj):
        return obj.courses.filter(
            is_published=True, status=Course.Status.PUBLISHED
        ).count()


class CourseInstructorSerializer(serializers.ModelSerializer):
    teacher_id_code = serializers.CharField(source="teacher.teacher_id", read_only=True)
    teacher_name = serializers.CharField(
        source="teacher.user.get_full_name",
        read_only=True,
    )
    teacher_email = serializers.EmailField(source="teacher.user.email", read_only=True)

    class Meta:
        model = CourseInstructor
        fields = [
            "id",
            "course",
            "teacher",
            "teacher_id_code",
            "teacher_name",
            "teacher_email",
            "is_primary",
            "assigned_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "teacher_id_code",
            "teacher_name",
            "teacher_email",
            "assigned_at",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        course = validated_data["course"]
        teacher = validated_data["teacher"]
        is_primary = validated_data.get("is_primary", False)
        existing = (
            CourseInstructor.all_objects.filter(course=course, teacher=teacher)
            .order_by("-updated_at")
            .first()
        )
        if existing is None:
            return CourseInstructor.objects.create(**validated_data)
        if existing.is_deleted:
            existing.restore()
        for field, value in validated_data.items():
            setattr(existing, field, value)
        existing.save()
        if is_primary:
            CourseInstructor.objects.filter(course=course, is_primary=True).exclude(
                pk=existing.pk
            ).update(is_primary=False)
        return existing


class CourseFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseFAQ
        fields = [
            "id",
            "course",
            "question",
            "answer",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CourseListSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("thumbnail",)

    categories = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    category_names = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    primary_instructor = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "categories",
            "category",
            "category_name",
            "category_names",
            "short_description",
            "enrollment_type",
            "price",
            "discount_price",
            "level",
            "duration_weeks",
            "duration_hours",
            "thumbnail",
            "is_published",
            "is_featured",
            "status",
            "language",
            "primary_instructor",
            "students_count",
            "start_date",
            "end_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_category_names(self, obj):
        return list(obj.categories.values_list("name", flat=True))

    def get_category_name(self, obj):
        names = self.get_category_names(obj)
        return names[0] if names else None

    def get_category(self, obj):
        first = obj.categories.first()
        return str(first.pk) if first else None

    def get_primary_instructor(self, obj):
        instructor = obj.instructors.filter(is_primary=True).select_related(
            "teacher__user"
        ).first()
        if not instructor:
            instructor = obj.instructors.select_related("teacher__user").first()
        if not instructor:
            return None
        return {
            "id": str(instructor.teacher_id),
            "name": instructor.teacher.user.get_full_name(),
            "teacher_id": instructor.teacher.teacher_id,
        }

    def get_students_count(self, obj):
        from apps.enrollments.models import Enrollment

        return Enrollment.objects.filter(
            course=obj,
            status__in=[
                Enrollment.Status.APPROVED,
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
                Enrollment.Status.SUSPENDED,
            ],
        ).values("student_id").distinct().count()


class CourseSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("thumbnail", "banner")

    categories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=CourseCategory.objects.all(),
        required=False,
    )
    category_detail = serializers.SerializerMethodField()
    category_names = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    # Backward-compatible single category write (appended into categories)
    category = serializers.PrimaryKeyRelatedField(
        queryset=CourseCategory.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    primary_instructor = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()
    instructors = CourseInstructorSerializer(many=True, read_only=True)
    instructor_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Teacher.objects.all(),
        write_only=True,
        required=False,
    )
    primary_instructor_id = serializers.PrimaryKeyRelatedField(
        queryset=Teacher.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    faqs = CourseFAQSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(
        source="created_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "categories",
            "category",
            "category_detail",
            "category_name",
            "category_names",
            "description",
            "short_description",
            "duration_weeks",
            "duration_hours",
            "start_date",
            "end_date",
            "working_days",
            "class_start_time",
            "class_end_time",
            "enrollment_type",
            "price",
            "discount_price",
            "level",
            "max_capacity",
            "thumbnail",
            "banner",
            "is_published",
            "is_featured",
            "status",
            "prerequisites",
            "learning_outcomes",
            "language",
            "created_by",
            "created_by_email",
            "instructors",
            "instructor_ids",
            "primary_instructor",
            "students_count",
            "primary_instructor_id",
            "faqs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "category_detail",
            "category_name",
            "category_names",
            "created_by",
            "created_by_email",
            "instructors",
            "primary_instructor",
            "faqs",
            "created_at",
            "updated_at",
        ]

    def get_category_names(self, obj):
        return list(obj.categories.values_list("name", flat=True))

    def get_category_name(self, obj):
        names = self.get_category_names(obj)
        return names[0] if names else None

    def get_category_detail(self, obj):
        first = obj.categories.first()
        if not first:
            return None
        return CourseCategorySerializer(first, context=self.context).data

    def get_primary_instructor(self, obj):
        instructor = obj.instructors.filter(is_primary=True).select_related(
            "teacher__user"
        ).first()
        if not instructor:
            instructor = obj.instructors.select_related("teacher__user").first()
        if not instructor:
            return None
        return {
            "id": str(instructor.teacher_id),
            "name": instructor.teacher.user.get_full_name(),
            "teacher_id": instructor.teacher.teacher_id,
        }

    def get_students_count(self, obj):
        from apps.enrollments.models import Enrollment

        return Enrollment.objects.filter(
            course=obj,
            status__in=[
                Enrollment.Status.APPROVED,
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
                Enrollment.Status.SUSPENDED,
            ],
        ).values("student_id").distinct().count()

    def _get_or_restore_instructor(self, course, teacher):
        """Avoid UniqueConstraint clashes with soft-deleted CourseInstructor rows."""
        existing = (
            CourseInstructor.all_objects.filter(course=course, teacher=teacher)
            .order_by("-updated_at")
            .first()
        )
        if existing is None:
            return CourseInstructor.objects.create(course=course, teacher=teacher)
        if existing.is_deleted:
            existing.restore()
        return existing

    def _sync_instructors(self, course, instructors, primary):
        if instructors is not None:
            incoming = {t.pk for t in instructors}
            CourseInstructor.objects.filter(course=course).exclude(
                teacher_id__in=incoming
            ).delete()
            for teacher in instructors:
                self._get_or_restore_instructor(course, teacher)
        if primary is not None:
            CourseInstructor.objects.filter(course=course).update(is_primary=False)
            if primary:
                obj = self._get_or_restore_instructor(course, primary)
                obj.is_primary = True
                obj.save(update_fields=["is_primary", "updated_at"])

    def _resolve_categories(self, validated_data):
        cats = validated_data.pop("categories", serializers.empty)
        single = validated_data.pop("category", serializers.empty)
        if cats is serializers.empty and single is serializers.empty:
            return serializers.empty
        resolved = []
        if cats is not serializers.empty:
            resolved.extend(cats)
        if single is not serializers.empty and single is not None:
            if single not in resolved:
                resolved.append(single)
        return resolved

    def create(self, validated_data):
        instructors = validated_data.pop("instructor_ids", None)
        primary = validated_data.pop("primary_instructor_id", None)
        categories = self._resolve_categories(validated_data)
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault("created_by", request.user)
        course = super().create(validated_data)
        if categories is not serializers.empty:
            course.categories.set(categories)
        self._sync_instructors(course, instructors, primary)
        return course

    def update(self, instance, validated_data):
        instructors = validated_data.pop("instructor_ids", None)
        primary = validated_data.pop("primary_instructor_id", serializers.empty)
        categories = self._resolve_categories(validated_data)
        course = super().update(instance, validated_data)
        if categories is not serializers.empty:
            course.categories.set(categories)
        if instructors is not None or primary is not serializers.empty:
            self._sync_instructors(
                course,
                instructors,
                None if primary is serializers.empty else primary,
            )
        return course

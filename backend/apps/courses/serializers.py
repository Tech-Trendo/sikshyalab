"""
Serializers for the courses app.
"""

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from apps.common.html import sanitize_rich_text
from apps.common.seo import SEO_FIELD_KWARGS, apply_seo_fallbacks
from apps.common.serializers_media import SafeMediaRepresentationMixin
from apps.content.models import CourseFAQ
from apps.content.serializers import CourseFAQSerializer
from apps.courses.models import Course, CourseCategory, CourseHighlight, CourseInstructor
from apps.teachers.models import Teacher

User = get_user_model()


def _prefetched_categories(obj):
    """Use in-memory prefetch when available (avoids N+1 on list endpoints)."""
    cache = getattr(obj, "_prefetched_objects_cache", None)
    if cache is not None and "categories" in cache:
        return list(obj.categories.all())
    return list(obj.categories.all())


def _prefetched_instructors(obj):
    cache = getattr(obj, "_prefetched_objects_cache", None)
    if cache is not None and "instructors" in cache:
        return list(obj.instructors.all())
    return list(obj.instructors.select_related("teacher__user").all())


def _primary_instructor_payload(obj):
    instructors = _prefetched_instructors(obj)
    instructor = next((i for i in instructors if getattr(i, "is_primary", False)), None)
    if instructor is None and instructors:
        instructor = instructors[0]
    if instructor is None:
        return None
    teacher = instructor.teacher
    user = getattr(teacher, "user", None)
    name = user.get_full_name() if user is not None else ""
    return {
        "id": str(instructor.teacher_id),
        "name": name,
        "teacher_id": teacher.teacher_id,
    }


def _students_count(obj):
    annotated = getattr(obj, "students_count_annotated", None)
    if annotated is not None:
        return int(annotated)
    from apps.enrollments.models import Enrollment

    return (
        Enrollment.objects.filter(
            course=obj,
            status__in=[
                Enrollment.Status.APPROVED,
                Enrollment.Status.ACTIVE,
                Enrollment.Status.COMPLETED,
                Enrollment.Status.SUSPENDED,
            ],
        )
        .values("student_id")
        .distinct()
        .count()
    )


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
        annotated = getattr(obj, "children_count_annotated", None)
        if annotated is not None:
            return int(annotated)
        cache = getattr(obj, "_prefetched_objects_cache", None)
        if cache is not None and "children" in cache:
            return len(obj.children.all())
        return obj.children.count()

    def get_course_count(self, obj):
        annotated = getattr(obj, "course_count_annotated", None)
        if annotated is not None:
            return int(annotated)
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


class CourseHighlightSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseHighlight
        fields = [
            "id",
            "course",
            "heading",
            "description",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "course", "created_at", "updated_at"]

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)
        else:
            return super().to_internal_value(data)
        if not str(data.get("heading") or "").strip():
            for key in ("title", "name", "label"):
                if data.get(key):
                    data["heading"] = data[key]
                    break
        if not str(data.get("description") or "").strip():
            for key in ("text", "body", "content", "copy"):
                if data.get(key):
                    data["description"] = data[key]
                    break
        return super().to_internal_value(data)

    def validate_heading(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def validate_description(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def validate(self, attrs):
        course = (
            attrs.get("course")
            or self.context.get("course")
            or getattr(self.instance, "course", None)
        )
        nested = getattr(self, "parent", None) is not None
        if course is None and not nested:
            raise serializers.ValidationError({"course": "Course is required."})
        if course is not None and self.instance is None and "order" not in self.initial_data:
            last = (
                CourseHighlight.objects.filter(course=course)
                .order_by("-order")
                .values_list("order", flat=True)
                .first()
            )
            attrs["order"] = 0 if last is None else last + 1
        return attrs


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
            "description",
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
        return [c.name for c in _prefetched_categories(obj)]

    def get_category_name(self, obj):
        names = self.get_category_names(obj)
        return names[0] if names else None

    def get_category(self, obj):
        cats = _prefetched_categories(obj)
        return str(cats[0].pk) if cats else None

    def get_primary_instructor(self, obj):
        return _primary_instructor_payload(obj)

    def get_students_count(self, obj):
        return _students_count(obj)


class CourseSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("thumbnail", "banner", "og_image")
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=270, validators=[])

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
    faqs = CourseFAQSerializer(many=True, required=False)
    highlights = CourseHighlightSerializer(many=True, required=False)
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
            "meta_title",
            "meta_description",
            "og_title",
            "og_description",
            "og_image",
            "is_published",
            "is_featured",
            "status",
            "prerequisites",
            "learning_outcomes",
            "language",
            "why_this_course_title",
            "highlights",
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
            "category_detail",
            "category_name",
            "category_names",
            "created_by",
            "created_by_email",
            "instructors",
            "primary_instructor",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "thumbnail": {"required": False, "allow_null": True},
            "banner": {"required": False, "allow_null": True},
            **SEO_FIELD_KWARGS,
        }

    def validate_description(self, value):
        return sanitize_rich_text(value or "")

    def _slug_taken(self, slug: str, *, exclude_pk=None) -> bool:
        qs = Course.all_objects.filter(slug=slug)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        return qs.exists()

    def _unique_slug(self, base: str, *, exclude_pk=None) -> str:
        slug_base = slugify(base) or "course"
        slug = slug_base
        counter = 1
        while self._slug_taken(slug, exclude_pk=exclude_pk):
            slug = f"{slug_base}-{counter}"
            counter += 1
        return slug

    def validate(self, attrs):
        attrs = super().validate(attrs)
        exclude_pk = self.instance.pk if self.instance else None
        if self.instance is not None and "slug" not in attrs:
            return attrs
        raw_slug = (attrs.get("slug") or "").strip()
        title = attrs.get("title") or (
            self.instance.title if self.instance is not None else "course"
        )
        if not raw_slug:
            attrs["slug"] = self._unique_slug(title, exclude_pk=exclude_pk)
        elif self._slug_taken(raw_slug, exclude_pk=exclude_pk):
            attrs["slug"] = self._unique_slug(raw_slug, exclude_pk=exclude_pk)
        else:
            attrs["slug"] = raw_slug
        return attrs

    def get_category_names(self, obj):
        return [c.name for c in _prefetched_categories(obj)]

    def get_category_name(self, obj):
        names = self.get_category_names(obj)
        return names[0] if names else None

    def get_category_detail(self, obj):
        cats = _prefetched_categories(obj)
        if not cats:
            return None
        return CourseCategorySerializer(cats[0], context=self.context).data

    def get_primary_instructor(self, obj):
        return _primary_instructor_payload(obj)

    def get_students_count(self, obj):
        return _students_count(obj)

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

    def _sync_highlights(self, course, items):
        CourseHighlight.objects.filter(course=course).delete()
        for index, item in enumerate(items or []):
            CourseHighlight.objects.create(
                course=course,
                heading=item["heading"],
                description=item["description"],
                order=item.get("order", index),
            )

    def _sync_faqs(self, course, items):
        CourseFAQ.objects.filter(course=course).delete()
        for index, item in enumerate(items or []):
            CourseFAQ.objects.create(
                course=course,
                question=item["question"],
                answer=item["answer"],
                order=item.get("order", index),
            )

    def _sync_slug_seo(self, course, old_slug):
        if not old_slug or old_slug == course.slug:
            return
        from django.contrib.contenttypes.models import ContentType
        from django.db import IntegrityError

        from apps.seo.models import RedirectRule, SEOMetadata, SitemapEntry

        new_path = f"/courses/{course.slug}"
        old_path = f"/courses/{old_slug}"
        ct = ContentType.objects.get_for_model(Course)
        SEOMetadata.objects.filter(content_type=ct, object_id=str(course.pk)).update(
            slug=course.slug,
            canonical_url=new_path,
        )
        try:
            SitemapEntry.objects.filter(url_path=old_path).update(
                url_path=new_path,
                is_active=True,
                is_published=True,
            )
        except IntegrityError:
            SitemapEntry.objects.filter(url_path=old_path).update(
                is_active=False,
                is_published=False,
            )
        RedirectRule.objects.update_or_create(
            from_path=old_path,
            defaults={
                "to_path": new_path,
                "status_code": RedirectRule.StatusCode.PERMANENT,
                "is_active": True,
            },
        )

    def create(self, validated_data):
        instructors = validated_data.pop("instructor_ids", None)
        primary = validated_data.pop("primary_instructor_id", None)
        highlights = validated_data.pop("highlights", None)
        faqs = validated_data.pop("faqs", None)
        categories = self._resolve_categories(validated_data)
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault("created_by", request.user)
        course = super().create(validated_data)
        if categories is not serializers.empty:
            course.categories.set(categories)
        self._sync_instructors(course, instructors, primary)
        if highlights is not None:
            self._sync_highlights(course, highlights)
        if faqs is not None:
            self._sync_faqs(course, faqs)
        return course

    def update(self, instance, validated_data):
        instructors = validated_data.pop("instructor_ids", None)
        primary = validated_data.pop("primary_instructor_id", serializers.empty)
        highlights = validated_data.pop("highlights", serializers.empty)
        faqs = validated_data.pop("faqs", serializers.empty)
        categories = self._resolve_categories(validated_data)
        old_slug = instance.slug
        course = super().update(instance, validated_data)
        if categories is not serializers.empty:
            course.categories.set(categories)
        if instructors is not None or primary is not serializers.empty:
            self._sync_instructors(
                course,
                instructors,
                None if primary is serializers.empty else primary,
            )
        if highlights is not serializers.empty:
            self._sync_highlights(course, highlights)
        if faqs is not serializers.empty:
            self._sync_faqs(course, faqs)
        if course.slug != old_slug:
            self._sync_slug_seo(course, old_slug)
        return course

    def to_representation(self, instance):
        data = super().to_representation(instance)
        fallback_desc = instance.short_description or instance.description
        fallback_image = data.get("thumbnail") or data.get("banner")
        return apply_seo_fallbacks(
            data,
            title=instance.title,
            description=fallback_desc,
            fallback_image_url=fallback_image,
        )

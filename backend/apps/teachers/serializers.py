"""
Serializers for the teachers app.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.teachers.models import (
    Teacher,
    TeacherDocument,
    TeacherExperience,
    TeacherQualification,
    TeacherSchedule,
    TeacherWorkload,
)
from apps.teachers.services import sync_teacher_user_profile

User = get_user_model()


class TeacherUserBriefSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "avatar",
        ]
        read_only_fields = fields


class TeacherQualificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherQualification
        fields = [
            "id",
            "teacher",
            "degree",
            "institution",
            "year",
            "field",
            "certificate_file",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TeacherExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherExperience
        fields = [
            "id",
            "teacher",
            "organization",
            "position",
            "from_date",
            "to_date",
            "description",
            "is_current",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = self.instance
        from_date = attrs.get("from_date", getattr(instance, "from_date", None))
        to_date = attrs.get("to_date", getattr(instance, "to_date", None))
        is_current = attrs.get("is_current", getattr(instance, "is_current", False))
        if to_date and from_date and to_date < from_date:
            raise serializers.ValidationError(
                {"to_date": "End date cannot be before start date."}
            )
        if is_current and to_date:
            raise serializers.ValidationError(
                {"to_date": "Current roles should not have an end date."}
            )
        return attrs


class TeacherDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherDocument
        fields = [
            "id",
            "teacher",
            "doc_type",
            "title",
            "file",
            "uploaded_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "uploaded_at", "created_at", "updated_at"]


class TeacherScheduleSerializer(serializers.ModelSerializer):
    day_of_week_display = serializers.CharField(
        source="get_day_of_week_display",
        read_only=True,
    )

    class Meta:
        model = TeacherSchedule
        fields = [
            "id",
            "teacher",
            "day_of_week",
            "day_of_week_display",
            "start_time",
            "end_time",
            "course",
            "batch",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "day_of_week_display", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = self.instance
        start = attrs.get("start_time", getattr(instance, "start_time", None))
        end = attrs.get("end_time", getattr(instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "End time must be after start time."}
            )
        return attrs


class TeacherWorkloadSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherWorkload
        fields = [
            "id",
            "teacher",
            "month",
            "year",
            "hours_assigned",
            "hours_completed",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("Month must be between 1 and 12.")
        return value


class TeacherAssignedCourseSerializer(serializers.Serializer):
    """Minimal course payload nested under teacher list/detail responses."""

    id = serializers.UUIDField()
    title = serializers.CharField()
    slug = serializers.CharField()
    is_primary = serializers.BooleanField()
    assigned_at = serializers.DateTimeField(allow_null=True)


class TeacherListSerializer(serializers.ModelSerializer):
    user = TeacherUserBriefSerializer(read_only=True)
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    assigned_courses = serializers.SerializerMethodField()
    assigned_course_ids = serializers.SerializerMethodField()
    assigned_courses_count = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id",
            "user",
            "full_name",
            "teacher_id",
            "employee_id",
            "designation",
            "department",
            "status",
            "bio",
            "years_of_experience",
            "joining_date",
            "assigned_courses",
            "assigned_course_ids",
            "assigned_courses_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _course_assignments(self, obj):
        return [
            a
            for a in obj.course_assignments.all()
            if not getattr(a, "is_deleted", False)
        ]

    def get_assigned_courses(self, obj):
        rows = []
        for assignment in self._course_assignments(obj):
            course = assignment.course
            if course is None or getattr(course, "is_deleted", False):
                continue
            rows.append(
                {
                    "id": course.id,
                    "title": course.title,
                    "slug": course.slug,
                    "is_primary": assignment.is_primary,
                    "assigned_at": assignment.assigned_at,
                }
            )
        return TeacherAssignedCourseSerializer(rows, many=True).data

    def get_assigned_course_ids(self, obj):
        return [
            str(a.course_id)
            for a in self._course_assignments(obj)
            if a.course_id and not getattr(a.course, "is_deleted", False)
        ]

    def get_assigned_courses_count(self, obj):
        return len(self.get_assigned_course_ids(obj))


class TeacherSerializer(serializers.ModelSerializer):
    user = TeacherUserBriefSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
        write_only=True,
        required=False,
    )
    qualifications = TeacherQualificationSerializer(many=True, read_only=True)
    experiences = TeacherExperienceSerializer(many=True, read_only=True)
    documents = TeacherDocumentSerializer(many=True, read_only=True)
    schedules = TeacherScheduleSerializer(many=True, read_only=True)
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    assigned_courses = serializers.SerializerMethodField()
    assigned_course_ids = serializers.SerializerMethodField()
    assigned_courses_count = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id",
            "user",
            "user_id",
            "full_name",
            "teacher_id",
            "employee_id",
            "designation",
            "department",
            "joining_date",
            "status",
            "bio",
            "specialization",
            "years_of_experience",
            "linkedin_url",
            "website",
            "qualifications",
            "experiences",
            "documents",
            "schedules",
            "assigned_courses",
            "assigned_course_ids",
            "assigned_courses_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "full_name",
            "qualifications",
            "experiences",
            "documents",
            "schedules",
            "assigned_courses",
            "assigned_course_ids",
            "assigned_courses_count",
            "created_at",
            "updated_at",
        ]

    def _course_assignments(self, obj):
        return [
            a
            for a in obj.course_assignments.all()
            if not getattr(a, "is_deleted", False)
        ]

    def get_assigned_courses(self, obj):
        rows = []
        for assignment in self._course_assignments(obj):
            course = assignment.course
            if course is None or getattr(course, "is_deleted", False):
                continue
            rows.append(
                {
                    "id": course.id,
                    "title": course.title,
                    "slug": course.slug,
                    "is_primary": assignment.is_primary,
                    "assigned_at": assignment.assigned_at,
                }
            )
        return TeacherAssignedCourseSerializer(rows, many=True).data

    def get_assigned_course_ids(self, obj):
        return [
            str(a.course_id)
            for a in self._course_assignments(obj)
            if a.course_id and not getattr(a.course, "is_deleted", False)
        ]

    def get_assigned_courses_count(self, obj):
        return len(self.get_assigned_course_ids(obj))

    def validate_user_id(self, value):
        if self.instance is None and Teacher.objects.filter(user=value).exists():
            raise serializers.ValidationError("This user already has a teacher profile.")
        return value

    def create(self, validated_data):
        if validated_data.get("user") is None:
            raise serializers.ValidationError({"user_id": "This field is required."})
        teacher = super().create(validated_data)
        sync_teacher_user_profile(teacher)
        return teacher

    def update(self, instance, validated_data):
        teacher = super().update(instance, validated_data)
        sync_teacher_user_profile(teacher)
        return teacher

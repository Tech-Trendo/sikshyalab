"""
Serializers for batches API.
"""

from rest_framework import serializers

from apps.batches.models import Batch, BatchSchedule, BatchStudent, Shift


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = [
            "id",
            "name",
            "code",
            "start_time",
            "end_time",
            "working_days",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BatchScheduleSerializer(serializers.ModelSerializer):
    day_of_week_display = serializers.CharField(
        source="get_day_of_week_display",
        read_only=True,
    )

    class Meta:
        model = BatchSchedule
        fields = [
            "id",
            "batch",
            "day_of_week",
            "day_of_week_display",
            "start_time",
            "end_time",
            "topic",
            "is_cancelled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "day_of_week_display", "created_at", "updated_at"]


class BatchStudentSerializer(serializers.ModelSerializer):
    student_id_display = serializers.CharField(
        source="student.student_id",
        read_only=True,
        allow_null=True,
    )
    batch_code = serializers.CharField(source="batch.code", read_only=True)

    class Meta:
        model = BatchStudent
        fields = [
            "id",
            "batch",
            "batch_code",
            "student",
            "student_id_display",
            "enrolled_at",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "enrolled_at",
            "batch_code",
            "student_id_display",
            "created_at",
            "updated_at",
        ]


class BatchSerializer(serializers.ModelSerializer):
    schedules = BatchScheduleSerializer(many=True, read_only=True)
    shift_detail = ShiftSerializer(source="shift", read_only=True)
    seats_available = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            "id",
            "course",
            "course_title",
            "name",
            "code",
            "shift",
            "shift_detail",
            "teacher",
            "teacher_name",
            "capacity",
            "enrolled_count",
            "seats_available",
            "is_full",
            "start_date",
            "end_date",
            "class_start_time",
            "class_end_time",
            "working_days",
            "status",
            "room_number",
            "meeting_link",
            "description",
            "created_by",
            "schedules",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "enrolled_count",
            "seats_available",
            "is_full",
            "created_by",
            "course_title",
            "teacher_name",
            "shift_detail",
            "schedules",
            "created_at",
            "updated_at",
        ]

    def get_teacher_name(self, obj):
        teacher = obj.teacher
        if teacher is None:
            return None
        user = getattr(teacher, "user", None)
        if user is not None:
            return user.get_full_name() if hasattr(user, "get_full_name") else str(user)
        return str(teacher)


class BatchListSerializer(serializers.ModelSerializer):
    seats_available = serializers.IntegerField(read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = Batch
        fields = [
            "id",
            "course",
            "course_title",
            "name",
            "code",
            "shift",
            "teacher",
            "capacity",
            "enrolled_count",
            "seats_available",
            "start_date",
            "end_date",
            "status",
            "room_number",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PublicUpcomingBatchSerializer(serializers.ModelSerializer):
    """Lean public payload for marketing site upcoming-batch cards."""

    course = serializers.CharField(source="course.title", read_only=True)
    slug = serializers.CharField(source="course.slug", read_only=True)
    start = serializers.SerializerMethodField()
    shift = serializers.SerializerMethodField()
    seats = serializers.IntegerField(source="seats_available", read_only=True)
    mode = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = ["id", "code", "course", "slug", "start", "shift", "seats", "mode", "status"]
        read_only_fields = fields

    def get_start(self, obj):
        if not obj.start_date:
            return ""
        return obj.start_date.strftime("%b %d, %Y")

    def get_shift(self, obj):
        if obj.shift_id and obj.shift:
            return obj.shift.name
        return ""

    def get_mode(self, obj):
        enrollment = getattr(obj.course, "enrollment_type", "") or ""
        mapping = {
            "PHYSICAL": "Physical",
            "ONLINE": "Online",
            "HYBRID": "Hybrid",
        }
        return mapping.get(enrollment, enrollment.title() if enrollment else "—")

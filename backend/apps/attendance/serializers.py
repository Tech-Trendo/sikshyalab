"""Serializers for attendance."""

from decimal import Decimal

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers

from apps.attendance.models import (
    AttendanceSession,
    MonthlyAttendanceSummary,
    StudentAttendance,
    TeacherAttendance,
)


class StudentAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAttendance
        fields = [
            "id",
            "student",
            "batch",
            "course",
            "date",
            "status",
            "marked_by",
            "remarks",
            "session_start",
            "session_end",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "marked_by", "created_at", "updated_at"]


class BulkMarkStudentAttendanceItemSerializer(serializers.Serializer):
    student = serializers.CharField(required=False)
    student_id = serializers.CharField(required=False)
    status = serializers.ChoiceField(choices=StudentAttendance.Status.choices)
    remarks = serializers.CharField(required=False, allow_blank=True)
    session_start = serializers.TimeField(required=False, allow_null=True)
    session_end = serializers.TimeField(required=False, allow_null=True)

    def validate(self, attrs):
        student = attrs.get("student") or attrs.get("student_id")
        if not student:
            raise serializers.ValidationError("student or student_id is required.")
        attrs["student"] = student
        return attrs


class BulkMarkStudentAttendanceSerializer(serializers.Serializer):
    batch = serializers.CharField()
    course = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    date = serializers.DateField()
    session_start = serializers.TimeField(required=False, allow_null=True)
    session_end = serializers.TimeField(required=False, allow_null=True)
    records = BulkMarkStudentAttendanceItemSerializer(many=True)

    def validate_records(self, records):
        if not records:
            raise serializers.ValidationError("At least one attendance record is required.")
        return records


class TeacherAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherAttendance
        fields = [
            "id",
            "teacher",
            "date",
            "status",
            "check_in",
            "check_out",
            "marked_by",
            "remarks",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "marked_by", "created_at", "updated_at"]


class BulkMarkTeacherAttendanceItemSerializer(serializers.Serializer):
    teacher = serializers.CharField(required=False)
    teacher_id = serializers.CharField(required=False)
    status = serializers.ChoiceField(choices=TeacherAttendance.Status.choices)
    check_in = serializers.DateTimeField(required=False, allow_null=True)
    check_out = serializers.DateTimeField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        teacher = attrs.get("teacher") or attrs.get("teacher_id")
        if not teacher:
            raise serializers.ValidationError("teacher or teacher_id is required.")
        attrs["teacher"] = teacher
        return attrs


class BulkMarkTeacherAttendanceSerializer(serializers.Serializer):
    date = serializers.DateField()
    records = BulkMarkTeacherAttendanceItemSerializer(many=True)

    def validate_records(self, records):
        if not records:
            raise serializers.ValidationError("At least one attendance record is required.")
        return records


class AttendanceSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceSession
        fields = [
            "id",
            "batch",
            "date",
            "topic",
            "taken_by",
            "taken_by_teacher",
            "start_time",
            "end_time",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "taken_by",
            "taken_by_teacher",
            "created_at",
            "updated_at",
        ]


class MonthlyAttendanceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyAttendanceSummary
        fields = [
            "id",
            "student",
            "teacher",
            "month",
            "year",
            "total_days",
            "present_days",
            "absent_days",
            "late_days",
            "attendance_percentage",
            "generated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "total_days",
            "present_days",
            "absent_days",
            "late_days",
            "attendance_percentage",
            "generated_at",
            "created_at",
            "updated_at",
        ]


class MonthlyReportQuerySerializer(serializers.Serializer):
    month = serializers.IntegerField(min_value=1, max_value=12)
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    student = serializers.CharField(required=False)
    teacher = serializers.CharField(required=False)
    batch = serializers.CharField(required=False)
    regenerate = serializers.BooleanField(default=True)


def build_student_monthly_summary(student, month, year, batch_id=None):
    qs = StudentAttendance.objects.filter(
        student=student,
        date__month=month,
        date__year=year,
    )
    if batch_id:
        qs = qs.filter(batch_id=batch_id)

    aggregates = qs.aggregate(
        total_days=Count("id"),
        present_days=Count("id", filter=Q(status=StudentAttendance.Status.PRESENT)),
        absent_days=Count("id", filter=Q(status=StudentAttendance.Status.ABSENT)),
        late_days=Count("id", filter=Q(status=StudentAttendance.Status.LATE)),
        half_days=Count("id", filter=Q(status=StudentAttendance.Status.HALF_DAY)),
        excused_days=Count("id", filter=Q(status=StudentAttendance.Status.EXCUSED)),
    )
    total = aggregates["total_days"] or 0
    present_days = aggregates["present_days"] or 0
    absent_days = aggregates["absent_days"] or 0
    late_days = aggregates["late_days"] or 0
    # Percentage: present + late + half*0.5 + excused over total
    effective = (
        present_days
        + late_days
        + (aggregates["excused_days"] or 0)
        + float(aggregates["half_days"] or 0) * 0.5
    )
    percentage = Decimal("0.00")
    if total:
        percentage = Decimal(str(round((effective / total) * 100, 2)))

    summary, _ = MonthlyAttendanceSummary.objects.update_or_create(
        student=student,
        teacher=None,
        month=month,
        year=year,
        defaults={
            "total_days": total,
            "present_days": present_days,
            "absent_days": absent_days,
            "late_days": late_days,
            "attendance_percentage": percentage,
            "generated_at": timezone.now(),
        },
    )
    return summary


def build_teacher_monthly_summary(teacher, month, year):
    qs = TeacherAttendance.objects.filter(
        teacher=teacher,
        date__month=month,
        date__year=year,
    )
    aggregates = qs.aggregate(
        total_days=Count("id"),
        present_days=Count("id", filter=Q(status=TeacherAttendance.Status.PRESENT)),
        absent_days=Count("id", filter=Q(status=TeacherAttendance.Status.ABSENT)),
        late_days=Count("id", filter=Q(status=TeacherAttendance.Status.LATE)),
    )
    total = aggregates["total_days"] or 0
    present_days = aggregates["present_days"] or 0
    absent_days = aggregates["absent_days"] or 0
    late_days = aggregates["late_days"] or 0
    percentage = Decimal("0.00")
    if total:
        percentage = Decimal(
            str(round(((present_days + late_days) / total) * 100, 2))
        )

    summary, _ = MonthlyAttendanceSummary.objects.update_or_create(
        student=None,
        teacher=teacher,
        month=month,
        year=year,
        defaults={
            "total_days": total,
            "present_days": present_days,
            "absent_days": absent_days,
            "late_days": late_days,
            "attendance_percentage": percentage,
            "generated_at": timezone.now(),
        },
    )
    return summary

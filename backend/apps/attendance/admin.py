from django.contrib import admin

from apps.attendance.models import (
    AttendanceSession,
    MonthlyAttendanceSummary,
    StudentAttendance,
    TeacherAttendance,
)


@admin.register(StudentAttendance)
class StudentAttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "batch",
        "course",
        "date",
        "status",
        "marked_by",
    )
    list_filter = ("status", "date", "batch")
    search_fields = ("remarks", "student__user__email")
    raw_id_fields = ("student", "batch", "course", "marked_by")
    date_hierarchy = "date"


@admin.register(TeacherAttendance)
class TeacherAttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "teacher",
        "date",
        "status",
        "check_in",
        "check_out",
        "marked_by",
    )
    list_filter = ("status", "date")
    search_fields = ("remarks", "teacher__user__email")
    raw_id_fields = ("teacher", "marked_by")
    date_hierarchy = "date"


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = (
        "batch",
        "date",
        "topic",
        "taken_by",
        "taken_by_teacher",
        "start_time",
        "end_time",
    )
    list_filter = ("date", "batch")
    search_fields = ("topic", "notes")
    raw_id_fields = ("batch", "taken_by", "taken_by_teacher")
    date_hierarchy = "date"


@admin.register(MonthlyAttendanceSummary)
class MonthlyAttendanceSummaryAdmin(admin.ModelAdmin):
    list_display = (
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
    )
    list_filter = ("year", "month")
    raw_id_fields = ("student", "teacher")

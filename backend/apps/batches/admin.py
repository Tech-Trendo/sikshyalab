from django.contrib import admin

from apps.batches.models import Batch, BatchSchedule, BatchStudent, Shift


class BatchScheduleInline(admin.TabularInline):
    model = BatchSchedule
    extra = 0


class BatchStudentInline(admin.TabularInline):
    model = BatchStudent
    extra = 0
    raw_id_fields = ("student",)
    readonly_fields = ("enrolled_at",)


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "start_time", "end_time", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "course",
        "teacher",
        "shift",
        "status",
        "capacity",
        "enrolled_count",
        "start_date",
        "end_date",
    )
    list_filter = ("status", "shift")
    search_fields = ("code", "name", "room_number")
    raw_id_fields = ("course", "teacher", "shift", "created_by")
    readonly_fields = ("id", "enrolled_count", "created_at", "updated_at")
    inlines = [BatchScheduleInline, BatchStudentInline]


@admin.register(BatchStudent)
class BatchStudentAdmin(admin.ModelAdmin):
    list_display = ("batch", "student", "status", "enrolled_at")
    list_filter = ("status",)
    search_fields = ("batch__code", "student__student_id")
    raw_id_fields = ("batch", "student")
    readonly_fields = ("enrolled_at",)


@admin.register(BatchSchedule)
class BatchScheduleAdmin(admin.ModelAdmin):
    list_display = (
        "batch",
        "day_of_week",
        "start_time",
        "end_time",
        "topic",
        "is_cancelled",
    )
    list_filter = ("day_of_week", "is_cancelled")
    search_fields = ("batch__code", "topic")
    raw_id_fields = ("batch",)

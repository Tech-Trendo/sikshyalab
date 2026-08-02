from django.contrib import admin

from apps.teachers.models import (
    Teacher,
    TeacherDocument,
    TeacherExperience,
    TeacherQualification,
    TeacherSchedule,
    TeacherWorkload,
)


class TeacherQualificationInline(admin.TabularInline):
    model = TeacherQualification
    extra = 0


class TeacherExperienceInline(admin.TabularInline):
    model = TeacherExperience
    extra = 0


class TeacherDocumentInline(admin.TabularInline):
    model = TeacherDocument
    extra = 0
    readonly_fields = ("uploaded_at",)


class TeacherScheduleInline(admin.TabularInline):
    model = TeacherSchedule
    extra = 0
    raw_id_fields = ("course", "batch")


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = (
        "teacher_id",
        "user",
        "employee_id",
        "designation",
        "department",
        "status",
        "years_of_experience",
        "joining_date",
    )
    list_filter = ("status", "department", "designation")
    search_fields = (
        "teacher_id",
        "employee_id",
        "user__email",
        "user__first_name",
        "user__last_name",
        "designation",
        "department",
    )
    raw_id_fields = ("user",)
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    inlines = [
        TeacherQualificationInline,
        TeacherExperienceInline,
        TeacherDocumentInline,
        TeacherScheduleInline,
    ]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "user",
                    "teacher_id",
                    "employee_id",
                    "designation",
                    "department",
                    "joining_date",
                    "status",
                )
            },
        ),
        (
            "Profile",
            {
                "fields": (
                    "bio",
                    "specialization",
                    "years_of_experience",
                    "linkedin_url",
                    "website",
                )
            },
        ),
        (
            "Meta",
            {"fields": ("created_at", "updated_at", "is_deleted", "deleted_at")},
        ),
    )


@admin.register(TeacherQualification)
class TeacherQualificationAdmin(admin.ModelAdmin):
    list_display = ("degree", "teacher", "institution", "year", "field")
    search_fields = ("degree", "institution", "field", "teacher__teacher_id")
    raw_id_fields = ("teacher",)


@admin.register(TeacherExperience)
class TeacherExperienceAdmin(admin.ModelAdmin):
    list_display = (
        "position",
        "organization",
        "teacher",
        "from_date",
        "to_date",
        "is_current",
    )
    list_filter = ("is_current",)
    search_fields = ("organization", "position", "teacher__teacher_id")
    raw_id_fields = ("teacher",)


@admin.register(TeacherDocument)
class TeacherDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "teacher", "doc_type", "uploaded_at")
    list_filter = ("doc_type",)
    search_fields = ("title", "teacher__teacher_id")
    raw_id_fields = ("teacher",)
    readonly_fields = ("uploaded_at",)


@admin.register(TeacherSchedule)
class TeacherScheduleAdmin(admin.ModelAdmin):
    list_display = (
        "teacher",
        "day_of_week",
        "start_time",
        "end_time",
        "course",
        "batch",
    )
    list_filter = ("day_of_week",)
    search_fields = ("teacher__teacher_id", "notes")
    raw_id_fields = ("teacher", "course", "batch")


@admin.register(TeacherWorkload)
class TeacherWorkloadAdmin(admin.ModelAdmin):
    list_display = (
        "teacher",
        "year",
        "month",
        "hours_assigned",
        "hours_completed",
    )
    list_filter = ("year", "month")
    search_fields = ("teacher__teacher_id", "notes")
    raw_id_fields = ("teacher",)

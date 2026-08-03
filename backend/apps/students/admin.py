from django.contrib import admin

from apps.students.models import (
    AcademicHistory,
    Guardian,
    Student,
    StudentActivityLog,
    StudentDocument,
)


class GuardianInline(admin.TabularInline):
    model = Guardian
    extra = 0
    fields = (
        "name",
        "relationship",
        "phone",
        "email",
        "occupation",
        "is_primary",
    )


class AcademicHistoryInline(admin.TabularInline):
    model = AcademicHistory
    extra = 0
    fields = (
        "institution",
        "degree_level",
        "field_of_study",
        "year_from",
        "year_to",
        "grade_gpa",
    )


class StudentDocumentInline(admin.TabularInline):
    model = StudentDocument
    extra = 0
    fields = ("doc_type", "title", "file", "issued_date")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = (
        "student_id",
        "user",
        "enrollment_number",
        "status",
        "admission_date",
        "profile_completed",
        "city",
        "created_at",
    )
    list_filter = ("status", "blood_group", "profile_completed", "country", "province")
    search_fields = (
        "student_id",
        "enrollment_number",
        "user__email",
        "user__first_name",
        "user__last_name",
        "emergency_contact_name",
        "emergency_contact_phone",
    )
    raw_id_fields = ("user", "deactivated_by")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at", "deactivated_at", "deactivated_by")
    inlines = [GuardianInline, AcademicHistoryInline, StudentDocumentInline]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "user",
                    "student_id",
                    "enrollment_number",
                    "status",
                    "deactivated_at",
                    "deactivated_by",
                    "admission_date",
                    "profile_completed",
                )
            },
        ),
        (
            "Personal",
            {
                "fields": (
                    "blood_group",
                    "nationality",
                    "religion",
                    "mother_tongue",
                    "emergency_contact_name",
                    "emergency_contact_phone",
                    "notes",
                )
            },
        ),
        (
            "Address",
            {
                "fields": (
                    "permanent_address",
                    "temporary_address",
                    "city",
                    "district",
                    "province",
                    "country",
                    "postal_code",
                )
            },
        ),
        (
            "Meta",
            {"fields": ("created_at", "updated_at", "is_deleted", "deleted_at")},
        ),
    )


@admin.register(Guardian)
class GuardianAdmin(admin.ModelAdmin):
    list_display = ("name", "student", "relationship", "phone", "is_primary")
    list_filter = ("relationship", "is_primary")
    search_fields = ("name", "phone", "email", "student__student_id")
    raw_id_fields = ("student",)


@admin.register(AcademicHistory)
class AcademicHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "institution",
        "student",
        "degree_level",
        "year_from",
        "year_to",
        "grade_gpa",
    )
    search_fields = ("institution", "degree_level", "field_of_study", "student__student_id")
    raw_id_fields = ("student",)


@admin.register(StudentDocument)
class StudentDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "student", "doc_type", "issued_date", "created_at")
    list_filter = ("doc_type",)
    search_fields = ("title", "student__student_id")
    raw_id_fields = ("student",)


@admin.register(StudentActivityLog)
class StudentActivityLogAdmin(admin.ModelAdmin):
    list_display = ("action", "student", "performed_by", "created_at")
    list_filter = ("action",)
    search_fields = ("action", "description", "student__student_id")
    raw_id_fields = ("student", "performed_by")
    readonly_fields = ("id", "created_at", "updated_at")

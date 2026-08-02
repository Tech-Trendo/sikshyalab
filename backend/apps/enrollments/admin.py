from django.contrib import admin

from apps.enrollments.models import Enrollment, EnrollmentDocument, EnrollmentHistory


class EnrollmentDocumentInline(admin.TabularInline):
    model = EnrollmentDocument
    extra = 0
    fields = ("title", "doc_type", "file")


class EnrollmentHistoryInline(admin.TabularInline):
    model = EnrollmentHistory
    extra = 0
    fields = ("from_status", "to_status", "changed_by", "remark", "created_at")
    readonly_fields = ("from_status", "to_status", "changed_by", "remark", "created_at")
    can_delete = False


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = (
        "enrollment_number",
        "student",
        "course",
        "batch",
        "status",
        "payment_status",
        "final_amount",
        "enrolled_at",
        "created_at",
    )
    list_filter = ("status", "payment_status", "enrollment_type", "course")
    search_fields = (
        "enrollment_number",
        "student__student_id",
        "course__title",
        "notes",
    )
    raw_id_fields = ("student", "course", "batch", "shift", "approved_by")
    readonly_fields = (
        "enrollment_number",
        "final_amount",
        "approved_at",
        "enrolled_at",
        "completed_at",
        "created_at",
        "updated_at",
    )
    inlines = [EnrollmentDocumentInline, EnrollmentHistoryInline]


@admin.register(EnrollmentHistory)
class EnrollmentHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "enrollment",
        "from_status",
        "to_status",
        "changed_by",
        "created_at",
    )
    list_filter = ("to_status", "from_status")
    search_fields = ("enrollment__enrollment_number", "remark")
    raw_id_fields = ("enrollment", "changed_by")
    readonly_fields = ("created_at", "updated_at")


@admin.register(EnrollmentDocument)
class EnrollmentDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "enrollment", "doc_type", "created_at")
    list_filter = ("doc_type",)
    search_fields = ("title", "enrollment__enrollment_number")
    raw_id_fields = ("enrollment",)

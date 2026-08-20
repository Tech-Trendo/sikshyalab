from django.contrib import admin

from apps.assignments.models import (
    Assignment,
    AssignmentAllocation,
    AssignmentResource,
    Submission,
    SubmissionReview,
)


class AssignmentResourceInline(admin.TabularInline):
    model = AssignmentResource
    extra = 0


class AssignmentAllocationInline(admin.TabularInline):
    model = AssignmentAllocation
    extra = 0
    raw_id_fields = ("student", "batch")


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "course",
        "batch",
        "teacher",
        "due_date",
        "max_marks",
        "status",
        "allow_late_submission",
    )
    list_filter = ("status", "course", "allow_late_submission")
    search_fields = ("title", "description", "instructions")
    raw_id_fields = ("course", "batch", "teacher")
    inlines = [AssignmentResourceInline, AssignmentAllocationInline]
    date_hierarchy = "due_date"


@admin.register(AssignmentResource)
class AssignmentResourceAdmin(admin.ModelAdmin):
    list_display = ("title", "assignment", "link")
    search_fields = ("title", "link", "assignment__title")
    raw_id_fields = ("assignment",)


@admin.register(AssignmentAllocation)
class AssignmentAllocationAdmin(admin.ModelAdmin):
    list_display = ("assignment", "student", "batch", "allocated_at")
    list_filter = ("allocated_at",)
    raw_id_fields = ("assignment", "student", "batch")


class SubmissionReviewInline(admin.StackedInline):
    model = SubmissionReview
    extra = 0
    raw_id_fields = ("reviewer", "reviewer_teacher")
    readonly_fields = ("graded_at",)


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "assignment",
        "student",
        "status",
        "attempt_number",
        "submitted_at",
        "has_attachment",
    )
    list_filter = ("status",)
    search_fields = ("content", "assignment__title", "student__user__email")
    raw_id_fields = ("assignment", "student")
    inlines = [SubmissionReviewInline]
    date_hierarchy = "submitted_at"
    fields = (
        "assignment",
        "student",
        "content",
        "attachment",
        "submitted_at",
        "status",
        "attempt_number",
    )
    readonly_fields = ("submitted_at",)

    @admin.display(boolean=True, description="File")
    def has_attachment(self, obj):
        return bool(obj.attachment)


@admin.register(SubmissionReview)
class SubmissionReviewAdmin(admin.ModelAdmin):
    list_display = (
        "submission",
        "marks_obtained",
        "status",
        "reviewer",
        "graded_at",
    )
    list_filter = ("status",)
    raw_id_fields = ("submission", "reviewer", "reviewer_teacher")

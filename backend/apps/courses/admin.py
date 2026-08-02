from django.contrib import admin

from apps.courses.models import Course, CourseCategory, CourseFAQ, CourseInstructor


class CourseInstructorInline(admin.TabularInline):
    model = CourseInstructor
    extra = 0
    raw_id_fields = ("teacher",)
    readonly_fields = ("assigned_at",)


class CourseFAQInline(admin.StackedInline):
    model = CourseFAQ
    extra = 0
    fields = ("question", "answer", "order")


@admin.register(CourseCategory)
class CourseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent", "is_active", "order", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}
    raw_id_fields = ("parent",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "level",
        "enrollment_type",
        "price",
        "is_published",
        "is_featured",
        "status",
        "created_at",
    )
    list_filter = (
        "level",
        "enrollment_type",
        "is_published",
        "is_featured",
        "status",
        "categories",
    )
    search_fields = ("title", "slug", "description", "short_description")
    prepopulated_fields = {"slug": ("title",)}
    raw_id_fields = ("created_by",)
    filter_horizontal = ("categories",)
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    inlines = [CourseInstructorInline, CourseFAQInline]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "title",
                    "slug",
                    "categories",
                    "short_description",
                    "description",
                    "status",
                    "is_published",
                    "is_featured",
                )
            },
        ),
        (
            "Schedule & delivery",
            {
                "fields": (
                    "duration_weeks",
                    "duration_hours",
                    "start_date",
                    "end_date",
                    "working_days",
                    "class_start_time",
                    "class_end_time",
                    "enrollment_type",
                    "level",
                    "language",
                    "max_capacity",
                )
            },
        ),
        (
            "Pricing",
            {"fields": ("price", "discount_price")},
        ),
        (
            "Media",
            {"fields": ("thumbnail", "banner")},
        ),
        (
            "Outcomes",
            {"fields": ("prerequisites", "learning_outcomes")},
        ),
        (
            "Meta",
            {
                "fields": (
                    "created_by",
                    "created_at",
                    "updated_at",
                    "is_deleted",
                    "deleted_at",
                )
            },
        ),
    )


@admin.register(CourseInstructor)
class CourseInstructorAdmin(admin.ModelAdmin):
    list_display = ("course", "teacher", "is_primary", "assigned_at")
    list_filter = ("is_primary",)
    search_fields = (
        "course__title",
        "teacher__teacher_id",
        "teacher__user__email",
    )
    raw_id_fields = ("course", "teacher")
    readonly_fields = ("assigned_at",)


@admin.register(CourseFAQ)
class CourseFAQAdmin(admin.ModelAdmin):
    list_display = ("question", "course", "order", "created_at")
    search_fields = ("question", "answer", "course__title")
    raw_id_fields = ("course",)
    ordering = ("course", "order")

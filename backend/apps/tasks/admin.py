from django.contrib import admin

from apps.tasks.models import BoardTask


@admin.register(BoardTask)
class BoardTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "student", "course_title", "assigned_by", "updated_at")
    list_filter = ("status", "created_by_role")
    search_fields = ("title", "course_title", "assigned_by")

from django.contrib import admin

from apps.analytics.models import SavedReport


@admin.register(SavedReport)
class SavedReportAdmin(admin.ModelAdmin):
    list_display = ("name", "report_type", "created_by", "created_at")
    list_filter = ("report_type", "created_at")
    search_fields = ("name", "created_by__email")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("created_by",)

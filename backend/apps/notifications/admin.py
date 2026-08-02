from django.contrib import admin

from apps.notifications.models import (
    Notification,
    NotificationDelivery,
    NotificationLog,
    NotificationPreference,
    NotificationTemplate,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "recipient",
        "notification_type",
        "event_code",
        "channel",
        "priority",
        "status",
        "is_read",
        "is_archived",
        "created_at",
    )
    list_filter = (
        "notification_type",
        "channel",
        "priority",
        "status",
        "is_read",
        "is_archived",
        "created_at",
    )
    search_fields = ("title", "message", "recipient__email", "event_code", "related_object_id")
    readonly_fields = ("uuid", "created_at", "updated_at", "read_at", "archived_at")
    raw_id_fields = ("recipient", "actor", "template")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "email_enabled",
        "sms_enabled",
        "in_app_enabled",
        "browser_enabled",
        "digest_daily",
        "digest_weekly",
        "updated_at",
    )
    list_filter = ("email_enabled", "sms_enabled", "in_app_enabled", "browser_enabled")
    search_fields = ("user__email",)
    raw_id_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "channel", "notification_type", "is_active", "updated_at")
    list_filter = ("channel", "notification_type", "is_active")
    search_fields = ("code", "name", "title_template")


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display = ("id", "notification", "channel", "status", "attempt_count", "created_at")
    list_filter = ("channel", "status")
    raw_id_fields = ("notification",)


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "notification", "actor", "created_at")
    list_filter = ("action",)
    raw_id_fields = ("notification", "actor")
    readonly_fields = ("created_at", "updated_at")

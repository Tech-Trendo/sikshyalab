from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import ActivityLog, User, UserProfile, UserSettings


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "first_name",
        "last_name",
        "role",
        "is_staff",
        "is_active",
        "is_active_account",
        "is_email_verified",
        "created_at",
    )
    list_filter = (
        "role",
        "is_staff",
        "is_superuser",
        "is_active",
        "is_active_account",
        "is_email_verified",
    )
    search_fields = ("email", "username", "first_name", "last_name", "phone")
    readonly_fields = ("created_at", "updated_at", "last_login", "date_joined")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Personal info",
            {"fields": ("username", "first_name", "last_name", "phone", "avatar", "avatar_url")},
        ),
        ("Role", {"fields": ("role",)}),
        (
            "Status",
            {
                "fields": (
                    "is_active",
                    "is_active_account",
                    "is_email_verified",
                    "is_staff",
                    "is_superuser",
                )
            },
        ),
        (
            "Permissions",
            {"fields": ("groups", "user_permissions")},
        ),
        (
            "Important dates",
            {"fields": ("last_login", "date_joined", "created_at", "updated_at", "last_login_ip")},
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "role", "is_staff"),
            },
        ),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "city", "country", "gender", "updated_at")
    search_fields = ("user__email", "title", "city", "country")
    raw_id_fields = ("user",)


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "language", "timezone", "compact_sidebar", "updated_at")
    list_filter = ("language", "compact_sidebar", "digest_weekly")
    search_fields = ("user__email",)
    raw_id_fields = ("user",)


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "module", "ip_address", "created_at")
    list_filter = ("action", "module", "created_at")
    search_fields = ("user__email", "action", "module", "object_repr")
    readonly_fields = (
        "user",
        "action",
        "module",
        "object_id",
        "object_repr",
        "ip_address",
        "user_agent",
        "metadata",
        "created_at",
    )
    date_hierarchy = "created_at"

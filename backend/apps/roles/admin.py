from django.contrib import admin

from apps.roles.models import FeatureFlag, Permission, Role, UserRole


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("codename", "name", "module", "created_at")
    list_filter = ("module",)
    search_fields = ("codename", "name", "module", "description")
    ordering = ("module", "codename")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "is_system", "is_active", "created_at")
    list_filter = ("is_system", "is_active")
    search_fields = ("name", "description")
    filter_horizontal = ("permissions",)


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "assigned_by", "assigned_at")
    list_filter = ("role", "assigned_at")
    search_fields = ("user__email", "role__name")
    raw_id_fields = ("user", "assigned_by")
    autocomplete_fields = ("role",)


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ("name", "codename", "is_enabled", "updated_at")
    list_filter = ("is_enabled",)
    search_fields = ("name", "codename", "description")
    filter_horizontal = ("roles",)

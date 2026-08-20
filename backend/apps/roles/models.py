from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Permission(models.Model):
    codename = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    module = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["module", "codename"]
        verbose_name = _("permission")
        verbose_name_plural = _("permissions")
        indexes = [
            models.Index(fields=["module", "codename"]),
        ]

    def __str__(self):
        return f"{self.module}.{self.codename}"


class Role(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(
        Permission,
        related_name="roles",
        blank=True,
    )
    is_system = models.BooleanField(
        default=False,
        help_text=_("System roles cannot be deleted."),
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = _("role")
        verbose_name_plural = _("roles")

    def __str__(self):
        return self.name


class UserRole(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_user_roles",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assigned_at"]
        verbose_name = _("user role")
        verbose_name_plural = _("user roles")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role"],
                name="unique_user_role",
            )
        ]

    def __str__(self):
        return f"{self.user} → {self.role}"


class FeatureFlag(models.Model):
    name = models.CharField(max_length=150)
    codename = models.CharField(max_length=100, unique=True, db_index=True)
    is_enabled = models.BooleanField(default=False)
    roles = models.ManyToManyField(
        Role,
        related_name="feature_flags",
        blank=True,
        help_text=_("Optional: restrict feature to these roles when enabled."),
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = _("feature flag")
        verbose_name_plural = _("feature flags")

    def __str__(self):
        status = "ON" if self.is_enabled else "OFF"
        return f"{self.name} [{status}]"

    def is_available_for(self, user):
        if not self.is_enabled:
            return False
        if not self.roles.exists():
            return True
        if not user or not user.is_authenticated:
            return False
        return self.roles.filter(user_roles__user=user, is_active=True).exists()


class UserPermissionOverride(models.Model):
    """
    Per-user overrides on top of Role defaults.

    Nullable booleans allow distinguishing:
      - null: no override → inherit from role
      - true/false: explicit override for that permission
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    module = models.CharField(max_length=100, db_index=True)

    can_view = models.BooleanField(null=True, blank=True)
    can_create = models.BooleanField(null=True, blank=True)
    can_edit = models.BooleanField(null=True, blank=True)
    can_delete = models.BooleanField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["module", "-updated_at"]
        verbose_name = _("user permission override")
        verbose_name_plural = _("user permission overrides")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "module"],
                name="unique_user_permission_override",
            )
        ]

    def __str__(self):
        return f"Override({self.user_id}, {self.module})"

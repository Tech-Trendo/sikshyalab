from django.apps import AppConfig
from django.core.management import call_command
from django.db.models.signals import post_migrate
from django.dispatch import receiver


class RolesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.roles"
    label = "roles"
    verbose_name = "Roles"


@receiver(post_migrate)
def _seed_roles_after_migrate(sender, app_config, **kwargs):
    """
    Ensure system RBAC roles/permissions exist for dev/tests.

    This preserves current behavior when nobody ran ``python manage.py seed_roles``.
    """
    if getattr(app_config, "name", None) != "apps.roles":
        return

    # Cheap existence check: if there's at least one permission, assume seeded.
    try:
        from apps.roles.models import Permission as RbacPermission

        if RbacPermission.objects.exists():
            return
    except Exception:
        return

    call_command("seed_roles", verbosity=0)

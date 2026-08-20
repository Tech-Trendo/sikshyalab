from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("roles", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserPermissionOverride",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("module", models.CharField(db_index=True, max_length=100)),
                ("can_view", models.BooleanField(blank=True, null=True)),
                ("can_create", models.BooleanField(blank=True, null=True)),
                ("can_edit", models.BooleanField(blank=True, null=True)),
                ("can_delete", models.BooleanField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="permission_overrides",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["module", "-updated_at"],
                "verbose_name": "user permission override",
                "verbose_name_plural": "user permission overrides",
            },
        ),
        migrations.AddConstraint(
            model_name="userpermissionoverride",
            constraint=models.UniqueConstraint(fields=("user", "module"), name="unique_user_permission_override"),
        ),
    ]


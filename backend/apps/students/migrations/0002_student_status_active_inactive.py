# Generated manually for student ACTIVE/INACTIVE + deactivation audit fields.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def normalize_student_status(apps, schema_editor):
    Student = apps.get_model("students", "Student")
    Student.objects.filter(status__in=["DROPPED", "SUSPENDED", "INACTIVE"]).update(
        status="INACTIVE"
    )
    Student.objects.exclude(status="INACTIVE").update(status="ACTIVE")


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(normalize_student_status, migrations.RunPython.noop),
        migrations.AddField(
            model_name="student",
            name="deactivated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="student",
            name="deactivated_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="deactivated_students",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="student",
            name="status",
            field=models.CharField(
                choices=[("ACTIVE", "Active"), ("INACTIVE", "Inactive")],
                db_index=True,
                default="ACTIVE",
                max_length=20,
            ),
        ),
    ]

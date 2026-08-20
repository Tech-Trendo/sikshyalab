# Default ClassSchedule.is_published to True and publish existing hidden rows.

from django.db import migrations, models


def publish_existing_class_schedules(apps, schema_editor):
    ClassSchedule = apps.get_model("content", "ClassSchedule")
    ClassSchedule.objects.filter(is_published=False).update(is_published=True)


def noop(apps, schema_editor):
    # Do not unpublish on reverse — those rows were never intentionally hidden.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0012_rename_content_cou_course__order_idx_content_cou_course__ad781a_idx"),
    ]

    operations = [
        migrations.AlterField(
            model_name="classschedule",
            name="is_published",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.RunPython(publish_existing_class_schedules, noop),
    ]

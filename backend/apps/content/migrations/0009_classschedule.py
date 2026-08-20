# Generated manually for upcoming ClassSchedule sessions

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0008_rename_content_top_part_id_order_idx_content_top_part_id_eed18e_idx"),
        ("courses", "0003_course_categories_m2m"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassSchedule",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("date", models.DateField(db_index=True)),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("is_published", models.BooleanField(db_index=True, default=False)),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="class_schedules",
                        to="courses.course",
                    ),
                ),
            ],
            options={
                "verbose_name": "class schedule",
                "verbose_name_plural": "class schedules",
                "ordering": ["date", "start_time", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="classschedule",
            index=models.Index(
                fields=["course", "date"],
                name="content_cla_course__date_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="classschedule",
            index=models.Index(
                fields=["course", "is_published", "date"],
                name="content_cla_course__pub_idx",
            ),
        ),
    ]

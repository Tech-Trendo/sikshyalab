# Generated for Why This Course? section

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0003_course_categories_m2m"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="why_this_course_title",
            field=models.CharField(
                blank=True,
                default="",
                help_text='Dynamic "Why this course?" section heading, e.g. "Why MERN Stack?".',
                max_length=255,
            ),
        ),
        migrations.CreateModel(
            name="CourseHighlight",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                ("heading", models.CharField(max_length=255)),
                ("description", models.TextField()),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="highlights",
                        to="courses.course",
                    ),
                ),
            ],
            options={
                "verbose_name": "course highlight",
                "verbose_name_plural": "course highlights",
                "ordering": ["order", "created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="coursehighlight",
            index=models.Index(
                fields=["course", "order"],
                name="courses_cou_course__order_idx",
            ),
        ),
    ]

# Course-specific FAQs moved into the content app (alongside class schedules).

import django.db.models.deletion
from django.db import migrations, models


def copy_legacy_course_faqs(apps, schema_editor):
    OldFAQ = apps.get_model("courses", "CourseFAQ")
    NewFAQ = apps.get_model("content", "CourseFAQ")
    rows = []
    for old in OldFAQ.objects.all().iterator():
        rows.append(
            NewFAQ(
                course_id=old.course_id,
                question=old.question,
                answer=old.answer,
                order=old.order,
                created_at=old.created_at,
                updated_at=old.updated_at,
            )
        )
    if rows:
        NewFAQ.objects.bulk_create(rows)


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0010_rename_content_cla_course__date_idx_content_cla_course__b008ee_idx_and_more"),
        ("courses", "0004_course_why_this_course_title_coursehighlight"),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseFAQ",
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
                ("question", models.CharField(max_length=500)),
                ("answer", models.TextField()),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                (
                    "course",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="faqs",
                        to="courses.course",
                    ),
                ),
            ],
            options={
                "verbose_name": "course FAQ",
                "verbose_name_plural": "course FAQs",
                "ordering": ["order", "created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="coursefaq",
            index=models.Index(
                fields=["course", "order"],
                name="content_cou_course__order_idx",
            ),
        ),
        migrations.RunPython(copy_legacy_course_faqs, migrations.RunPython.noop),
    ]

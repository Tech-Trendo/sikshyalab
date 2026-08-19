# Generated manually for Chapter → Part → Topic curriculum

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0006_partresource_video_compression_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="Topic",
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
                ("title", models.CharField(max_length=255)),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                (
                    "part",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="topics",
                        to="content.part",
                    ),
                ),
            ],
            options={
                "verbose_name": "topic",
                "verbose_name_plural": "topics",
                "ordering": ["part", "order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="topic",
            index=models.Index(fields=["part", "order"], name="content_top_part_id_order_idx"),
        ),
    ]

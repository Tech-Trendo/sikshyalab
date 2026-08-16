from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Video",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False, db_index=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("original_filename", models.CharField(max_length=255)),
                ("original_size", models.BigIntegerField()),
                ("compressed_size", models.BigIntegerField(blank=True, null=True)),
                ("compression_percentage", models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ("original_s3_key", models.CharField(blank=True, default="", max_length=1024)),
                ("compressed_s3_key", models.CharField(blank=True, default="", max_length=1024)),
                ("duration", models.FloatField(blank=True, null=True)),
                ("width", models.PositiveIntegerField(blank=True, null=True)),
                ("height", models.PositiveIntegerField(blank=True, null=True)),
                ("fps", models.FloatField(blank=True, null=True)),
                ("codec", models.CharField(blank=True, default="", max_length=128)),
                ("bitrate", models.BigIntegerField(blank=True, null=True)),
                ("status", models.CharField(choices=[("UPLOADING", "UPLOADING"), ("PROCESSING", "PROCESSING"), ("COMPLETED", "COMPLETED"), ("FAILED", "FAILED")], db_index=True, default="UPLOADING", max_length=20)),
                ("error_message", models.TextField(blank=True, default="")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="videos", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]

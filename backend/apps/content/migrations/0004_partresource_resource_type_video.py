# Generated manually for VIDEO resource_type choice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0003_chapter_video_part_video_file_videopart"),
    ]

    operations = [
        migrations.AlterField(
            model_name="partresource",
            name="resource_type",
            field=models.CharField(
                choices=[
                    ("VIDEO", "Video"),
                    ("PDF", "PDF"),
                    ("DOC", "Document"),
                    ("LINK", "Link"),
                    ("OTHER", "Other"),
                ],
                default="OTHER",
                max_length=20,
            ),
        ),
    ]

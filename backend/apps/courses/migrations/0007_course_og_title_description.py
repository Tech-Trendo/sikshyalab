# Generated for Course Open Graph title/description

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0006_course_seo_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="og_title",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph title. Recommended: 60 characters max. Leave blank to use the course title.",
                max_length=70,
            ),
        ),
        migrations.AddField(
            model_name="course",
            name="og_description",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph description. Recommended: 160 characters max. Leave blank to use the short description.",
                max_length=160,
            ),
        ),
        migrations.AlterField(
            model_name="course",
            name="og_image",
            field=models.ImageField(
                blank=True,
                help_text="Open Graph image. Recommended size: 1200×630px. Leave blank to use the thumbnail.",
                null=True,
                upload_to="courses/og/",
            ),
        ),
    ]

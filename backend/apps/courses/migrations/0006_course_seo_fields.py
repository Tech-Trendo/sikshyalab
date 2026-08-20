# Optional SEO fields on Course, matching BlogPost / Event.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0005_remove_coursefaq"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="meta_title",
            field=models.CharField(blank=True, max_length=70),
        ),
        migrations.AddField(
            model_name="course",
            name="meta_description",
            field=models.CharField(blank=True, max_length=320),
        ),
        migrations.AddField(
            model_name="course",
            name="og_image",
            field=models.ImageField(blank=True, null=True, upload_to="courses/og/"),
        ),
    ]

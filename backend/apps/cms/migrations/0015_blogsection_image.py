# Generated for BlogSection.image

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0014_seed_itahari_site_coordinates"),
    ]

    operations = [
        migrations.AddField(
            model_name="blogsection",
            name="image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="cms/blog/sections/",
            ),
        ),
    ]

# Generated for SEOMetadata Open Graph help text

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("seo", "0005_sitemapentry_index_names"),
    ]

    operations = [
        migrations.AlterField(
            model_name="seometadata",
            name="og_title",
            field=models.CharField(
                blank=True,
                help_text="Recommended: 60 characters max.",
                max_length=100,
            ),
        ),
        migrations.AlterField(
            model_name="seometadata",
            name="og_description",
            field=models.CharField(
                blank=True,
                help_text="Recommended: 160 characters max.",
                max_length=320,
            ),
        ),
        migrations.AlterField(
            model_name="seometadata",
            name="og_image",
            field=models.ImageField(
                blank=True,
                help_text="Recommended image size: 1200×630px.",
                null=True,
                upload_to="seo/og/",
            ),
        ),
    ]

# Generated for SiteSetting / BlogPost / Event Open Graph fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0015_blogsection_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="og_title",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph title. Recommended: 60 characters max. Leave blank to use the site name.",
                max_length=70,
            ),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="og_description",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph description. Recommended: 160 characters max. Leave blank to use the tagline.",
                max_length=160,
            ),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="og_image",
            field=models.ImageField(
                blank=True,
                help_text="Open Graph image. Recommended size: 1200×630px. Leave blank to use the site logo.",
                null=True,
                upload_to="cms/site/og/",
            ),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="og_title",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph title. Recommended: 60 characters max. Leave blank to use the post title.",
                max_length=70,
            ),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="og_description",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph description. Recommended: 160 characters max. Leave blank to use the excerpt.",
                max_length=160,
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="og_title",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph title. Recommended: 60 characters max. Leave blank to use the event title.",
                max_length=70,
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="og_description",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Open Graph description. Recommended: 160 characters max. Leave blank to use the event description.",
                max_length=160,
            ),
        ),
        migrations.AlterField(
            model_name="blogpost",
            name="og_image",
            field=models.ImageField(
                blank=True,
                help_text="Open Graph image. Recommended size: 1200×630px. Leave blank to use the cover image.",
                null=True,
                upload_to="cms/blog/og/",
            ),
        ),
        migrations.AlterField(
            model_name="event",
            name="og_image",
            field=models.ImageField(
                blank=True,
                help_text="Open Graph image. Recommended size: 1200×630px. Leave blank to use the cover image.",
                null=True,
                upload_to="cms/events/og/",
            ),
        ),
    ]

# Generated manually for SiteSetting map coordinates

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0009_galleryitem_event"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text="Map latitude for the Contact page (−90 to 90). Null = hide map.",
                max_digits=9,
                null=True,
                validators=[MinValueValidator(-90), MaxValueValidator(90)],
            ),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="longitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text="Map longitude for the Contact page (−180 to 180). Null = hide map.",
                max_digits=9,
                null=True,
                validators=[MinValueValidator(-180), MaxValueValidator(180)],
            ),
        ),
    ]

from decimal import Decimal

from django.db import migrations


ITAHARI_LATITUDE = Decimal("26.660003338049687")
ITAHARI_LONGITUDE = Decimal("87.28886844907426")


def seed_itahari_coordinates(apps, schema_editor):
    SiteSetting = apps.get_model("cms", "SiteSetting")
    SiteSetting.objects.filter(address__icontains="itahari").update(
        latitude=ITAHARI_LATITUDE,
        longitude=ITAHARI_LONGITUDE,
    )


def clear_seeded_itahari_coordinates(apps, schema_editor):
    SiteSetting = apps.get_model("cms", "SiteSetting")
    SiteSetting.objects.filter(
        address__icontains="itahari",
        latitude=ITAHARI_LATITUDE,
        longitude=ITAHARI_LONGITUDE,
    ).update(
        latitude=None,
        longitude=None,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0013_blogsection_and_seo_fields"),
    ]

    operations = [
        migrations.RunPython(seed_itahari_coordinates, clear_seeded_itahari_coordinates),
    ]

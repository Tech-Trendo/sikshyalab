# Generated manually for SiteSetting Google Search Console verification

from django.db import migrations, models


VERIFICATION_TOKEN = "AUeQdOoRppmQeWF0FE533AQiEzVCLiBzdG-ergqevLg"


def seed_search_console_verification(apps, schema_editor):
    SiteSetting = apps.get_model("cms", "SiteSetting")
    # Prefer published solo row; otherwise update all existing rows so the API has a value.
    qs = SiteSetting.objects.filter(is_published=True).order_by("-created_at")
    target = qs.first() or SiteSetting.objects.order_by("-created_at").first()
    if target is None:
        return
    if not (target.google_search_console_verification or "").strip():
        target.google_search_console_verification = VERIFICATION_TOKEN
        target.save(update_fields=["google_search_console_verification"])


def unseed_search_console_verification(apps, schema_editor):
    SiteSetting = apps.get_model("cms", "SiteSetting")
    SiteSetting.objects.filter(
        google_search_console_verification=VERIFICATION_TOKEN
    ).update(google_search_console_verification=None)


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0010_sitesetting_latitude_longitude"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="google_search_console_verification",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Google Search Console meta verification token only "
                    "(e.g. AUeQdOo…), without the google-site-verification= prefix."
                ),
                max_length=255,
                null=True,
            ),
        ),
        migrations.RunPython(
            seed_search_console_verification,
            unseed_search_console_verification,
        ),
    ]

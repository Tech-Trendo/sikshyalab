from django.db import migrations, models


def hindi_to_nepali(apps, schema_editor):
    UserSettings = apps.get_model("accounts", "UserSettings")
    UserSettings.objects.filter(language="hi").update(language="ne")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_settings_and_profile_fields"),
    ]

    operations = [
        migrations.RunPython(hindi_to_nepali, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="usersettings",
            name="language",
            field=models.CharField(
                choices=[("en", "English"), ("ne", "Nepali")],
                default="en",
                max_length=8,
            ),
        ),
    ]

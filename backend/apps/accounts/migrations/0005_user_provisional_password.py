from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_must_change_password_and_reset_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="provisional_password",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Last issued temporary password (admin-visible until the user changes it).",
                max_length=128,
            ),
        ),
    ]

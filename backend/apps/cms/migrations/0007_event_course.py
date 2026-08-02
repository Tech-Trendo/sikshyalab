from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0001_initial"),
        ("cms", "0006_contactmessage_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="course",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="events",
                to="courses.course",
            ),
        ),
    ]

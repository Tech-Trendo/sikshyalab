from django.db import migrations, models


def seed_testimonials_copy(apps, schema_editor):
    SiteSetting = apps.get_model("cms", "SiteSetting")
    SiteSetting.objects.filter(testimonials_eyebrow="").update(
        testimonials_eyebrow="Testimonials",
    )
    SiteSetting.objects.filter(testimonials_heading="").update(
        testimonials_heading="What Our Students|Have To Say",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0007_event_course"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="testimonials_eyebrow",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="testimonials_heading",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.RunPython(seed_testimonials_copy, migrations.RunPython.noop),
    ]

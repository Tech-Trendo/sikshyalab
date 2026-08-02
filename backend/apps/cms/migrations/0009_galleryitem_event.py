from django.db import migrations, models
import django.db.models.deletion


def backfill_gallery_event(apps, schema_editor):
    GalleryItem = apps.get_model("cms", "GalleryItem")
    Event = apps.get_model("cms", "Event")
    events_by_title = {e.title: e for e in Event.objects.all()}
    for item in GalleryItem.objects.filter(event__isnull=True).exclude(category=""):
        event = events_by_title.get(item.category)
        if event is not None:
            GalleryItem.objects.filter(pk=item.pk).update(event_id=event.pk)


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0008_sitesetting_testimonials_section"),
    ]

    operations = [
        migrations.AddField(
            model_name="galleryitem",
            name="event",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="gallery_items",
                to="cms.event",
            ),
        ),
        migrations.AddIndex(
            model_name="galleryitem",
            index=models.Index(
                fields=["is_published", "order"],
                name="cms_gallery_is_publ_8e6b2a_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="galleryitem",
            index=models.Index(
                fields=["event", "is_published"],
                name="cms_gallery_event_i_4c9f1d_idx",
            ),
        ),
        migrations.RunPython(backfill_gallery_event, migrations.RunPython.noop),
    ]

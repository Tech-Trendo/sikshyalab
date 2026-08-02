# Generated manually for ContactMessage status CRM flow

from django.db import migrations, models


def forwards_status(apps, schema_editor):
    ContactMessage = apps.get_model("cms", "ContactMessage")
    for row in ContactMessage.objects.all().iterator():
        if row.replied_at_id if hasattr(row, "replied_at_id") else row.replied_at:
            status = "CONTACTED"
        elif row.is_read:
            status = "CONTACTED"
        else:
            status = "PENDING"
        ContactMessage.objects.filter(pk=row.pk).update(status=status)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0005_partner"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactmessage",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("CONTACTED", "Contacted"),
                    ("CONVERTED", "Converted"),
                    ("LOST", "Lost"),
                ],
                db_index=True,
                default="PENDING",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="contactmessage",
            index=models.Index(
                fields=["status", "-created_at"],
                name="cms_contact_status_created_idx",
            ),
        ),
        migrations.RunPython(forwards_status, noop_reverse),
    ]

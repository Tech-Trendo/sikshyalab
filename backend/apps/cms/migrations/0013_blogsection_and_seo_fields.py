# Generated for blog sections + optional SEO fields on BlogPost and Event.

import uuid

import django.db.models.deletion
from django.db import migrations, models


def copy_blog_content_to_sections(apps, schema_editor):
    BlogPost = apps.get_model("cms", "BlogPost")
    BlogSection = apps.get_model("cms", "BlogSection")
    for post in BlogPost.objects.iterator():
        content = post.content or ""
        if not content.strip():
            continue
        if BlogSection.objects.filter(blog_post_id=post.pk).exists():
            continue
        BlogSection.objects.create(
            blog_post_id=post.pk,
            title=None,
            description=content,
            order=0,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0012_rename_cms_contact_status_created_idx_cms_contact_status_34aaa4_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="blogpost",
            name="content",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="meta_title",
            field=models.CharField(blank=True, max_length=70),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="meta_description",
            field=models.CharField(blank=True, max_length=320),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="og_image",
            field=models.ImageField(blank=True, null=True, upload_to="cms/blog/og/"),
        ),
        migrations.AddField(
            model_name="event",
            name="meta_title",
            field=models.CharField(blank=True, max_length=70),
        ),
        migrations.AddField(
            model_name="event",
            name="meta_description",
            field=models.CharField(blank=True, max_length=320),
        ),
        migrations.AddField(
            model_name="event",
            name="og_image",
            field=models.ImageField(blank=True, null=True, upload_to="cms/events/og/"),
        ),
        migrations.CreateModel(
            name="BlogSection",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                ("title", models.CharField(blank=True, max_length=255, null=True)),
                ("description", models.TextField()),
                ("order", models.PositiveIntegerField(db_index=True, default=0)),
                (
                    "blog_post",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sections",
                        to="cms.blogpost",
                    ),
                ),
            ],
            options={
                "verbose_name": "blog section",
                "verbose_name_plural": "blog sections",
                "ordering": ["order", "created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="blogsection",
            index=models.Index(
                fields=["blog_post", "order"],
                name="cms_blogsec_post_order_idx",
            ),
        ),
        migrations.RunPython(copy_blog_content_to_sections, noop_reverse),
    ]

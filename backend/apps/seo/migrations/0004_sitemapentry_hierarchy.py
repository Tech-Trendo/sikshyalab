# Hierarchical sitemap fields on SitemapEntry

from django.db import migrations, models
import django.db.models.deletion


def backfill_sitemap_hierarchy(apps, schema_editor):
    SitemapEntry = apps.get_model("seo", "SitemapEntry")
    used = set()

    def slug_from_path(path: str) -> str:
        value = (path or "/").strip() or "/"
        if value != "/" and not value.startswith("/"):
            value = f"/{value}"
        if value == "/":
            return "home"
        return value.strip("/").replace("/", "-")

    def infer_page_type(path: str) -> str:
        value = path or "/"
        if value.startswith("/courses/") and value.count("/") >= 2:
            return "course"
        if value.startswith("/blog/") and value.count("/") >= 2:
            return "blog"
        if value.startswith("/events/") and value.count("/") >= 2:
            return "event"
        return "page"

    for row in SitemapEntry.objects.all().order_by("created_at"):
        path = row.url_path or "/"
        slug = slug_from_path(path)
        base = slug
        n = 2
        while slug in used:
            slug = f"{base}-{n}"
            n += 1
        used.add(slug)
        row.slug = slug
        if not (row.title or "").strip():
            row.title = "Home" if slug == "home" else base.replace("-", " ").title()
        row.page_type = infer_page_type(path)
        row.is_published = bool(row.is_active)
        row.is_indexable = True
        row.save(
            update_fields=[
                "slug",
                "title",
                "page_type",
                "is_published",
                "is_indexable",
            ]
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("seo", "0003_rename_seo_seometa_canonic_idx_seo_seometa_canonic_cbf98d_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitemapentry",
            name="title",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="sitemapentry",
            name="slug",
            field=models.CharField(blank=True, default="", max_length=270),
        ),
        migrations.AddField(
            model_name="sitemapentry",
            name="page_type",
            field=models.CharField(
                choices=[
                    ("page", "Page"),
                    ("course", "Course"),
                    ("blog", "Blog"),
                    ("event", "Event"),
                    ("category", "Category"),
                    ("custom", "Custom"),
                ],
                db_index=True,
                default="page",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="sitemapentry",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="children",
                to="seo.sitemapentry",
            ),
        ),
        migrations.AddField(
            model_name="sitemapentry",
            name="is_published",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AddField(
            model_name="sitemapentry",
            name="is_indexable",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AddField(
            model_name="sitemapentry",
            name="order",
            field=models.PositiveIntegerField(db_index=True, default=0),
        ),
        migrations.RunPython(backfill_sitemap_hierarchy, noop_reverse),
        migrations.AlterField(
            model_name="sitemapentry",
            name="slug",
            field=models.CharField(
                db_index=True,
                help_text="Unique page key used in /api/sitemap/<slug>/. Homepage uses 'home'.",
                max_length=270,
                unique=True,
            ),
        ),
        migrations.AlterModelOptions(
            name="sitemapentry",
            options={
                "ordering": ["order", "-priority", "url_path"],
                "verbose_name": "sitemap entry",
                "verbose_name_plural": "sitemap entries",
            },
        ),
        migrations.AddIndex(
            model_name="sitemapentry",
            index=models.Index(
                fields=["is_published", "is_indexable"],
                name="seo_sitemap_pub_idx_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="sitemapentry",
            index=models.Index(fields=["parent", "order"], name="seo_sitemap_parent_ord_idx"),
        ),
        migrations.AddIndex(
            model_name="sitemapentry",
            index=models.Index(fields=["updated_at"], name="seo_sitemap_updated_idx"),
        ),
        migrations.AddIndex(
            model_name="sitemapentry",
            index=models.Index(
                fields=["page_type", "is_published"],
                name="seo_sitemap_type_pub_idx",
            ),
        ),
    ]

# Generated manually for SEO lookup performance

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("seo", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="seometadata",
            index=models.Index(fields=["canonical_url"], name="seo_seometa_canonic_idx"),
        ),
        migrations.AddIndex(
            model_name="seometadata",
            index=models.Index(
                fields=["is_indexed", "canonical_url"],
                name="seo_seometa_indexed_canon_idx",
            ),
        ),
    ]

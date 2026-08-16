"""
Copy objects from S3 (active default_storage) into local MEDIA_ROOT.

Does **not** modify PostgreSQL FileField keys. Used so DEBUG can serve
``/media/<key>`` from disk via ``static(MEDIA_URL, document_root=MEDIA_ROOT)``.

Usage:
  python manage.py sync_s3_media_to_local
  python manage.py sync_s3_media_to_local --dry-run
  python manage.py sync_s3_media_to_local --prefix cms/partners/
"""

from __future__ import annotations

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models import FileField, ImageField

from apps.common.media_utils import (
    cache_storage_object_locally,
    local_media_file_exists,
    media_file_exists,
    normalize_relpath,
)


class Command(BaseCommand):
    help = "Mirror S3 media objects referenced by the database into local MEDIA_ROOT."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report only; do not write files.",
        )
        parser.add_argument(
            "--prefix",
            default="",
            help="Only sync relative paths under this prefix (e.g. cms/partners/).",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "USE_S3", False):
            raise CommandError("USE_S3 must be true to sync S3 objects to local MEDIA_ROOT.")

        dry = options["dry_run"]
        prefix = normalize_relpath(options["prefix"])
        seen: set[str] = set()
        downloaded = 0
        skipped = 0
        missing = 0

        for model in apps.get_models():
            fields = [f for f in model._meta.local_fields if isinstance(f, (FileField, ImageField))]
            if not fields:
                continue
            for obj in model.objects.all().iterator():
                for field in fields:
                    val = getattr(obj, field.name)
                    name = getattr(val, "name", "") or ""
                    rel = normalize_relpath(name)
                    if not rel or rel in seen:
                        continue
                    if prefix and not rel.startswith(prefix):
                        continue
                    seen.add(rel)
                    if local_media_file_exists(rel):
                        skipped += 1
                        continue
                    if dry:
                        if media_file_exists(rel):
                            self.stdout.write(f"[dry-run] would download {rel}")
                            downloaded += 1
                        else:
                            self.stdout.write(self.style.WARNING(f"[dry-run] missing on S3: {rel}"))
                            missing += 1
                        continue
                    if cache_storage_object_locally(rel):
                        downloaded += 1
                        self.stdout.write(self.style.SUCCESS(f"Downloaded {rel}"))
                    else:
                        missing += 1
                        self.stdout.write(self.style.WARNING(f"Missing on S3: {rel}"))

        self.stdout.write(
            f"keys={len(seen)} downloaded={downloaded} already_local={skipped} missing={missing}"
        )

"""
Upload legacy local MEDIA_ROOT files to S3 using the same relative keys
stored in PostgreSQL FileField/ImageField columns.

Does **not** modify the database. New uploads already go to S3 via MediaStorage;
this command only migrates files that still exist under local MEDIA_ROOT.

Usage:
  python manage.py sync_local_media_to_s3
  python manage.py sync_local_media_to_s3 --dry-run
  python manage.py sync_local_media_to_s3 --prefix cms/gallery/
"""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.common.media_utils import (
    clear_media_exists_cache,
    media_file_exists,
    media_root,
    normalize_relpath,
    promote_local_file_to_s3,
)


class Command(BaseCommand):
    help = "Sync legacy local media files to S3 without changing PostgreSQL keys."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report only; do not upload.",
        )
        parser.add_argument(
            "--prefix",
            default="",
            help="Only sync relative paths under this prefix (e.g. cms/gallery/).",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "USE_S3", False):
            raise CommandError("USE_S3 must be true to sync local media to S3.")

        dry = options["dry_run"]
        prefix = normalize_relpath(options["prefix"])
        root = media_root()
        if not root.is_dir():
            self.stdout.write(self.style.WARNING(f"No local MEDIA_ROOT at {root}"))
            return

        uploaded = 0
        skipped = 0
        failed = 0
        examined = 0

        for path in root.rglob("*"):
            if not path.is_file():
                continue
            try:
                rel = path.relative_to(root).as_posix()
            except ValueError:
                continue
            if prefix and not rel.startswith(prefix):
                continue
            examined += 1
            if media_file_exists(rel):
                skipped += 1
                continue
            if dry:
                self.stdout.write(f"[dry-run] would upload {rel}")
                uploaded += 1
                continue
            try:
                ok = promote_local_file_to_s3(rel)
                if ok:
                    uploaded += 1
                    self.stdout.write(self.style.SUCCESS(f"Uploaded {rel}"))
                else:
                    failed += 1
                    self.stdout.write(self.style.ERROR(f"Failed {rel}"))
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.ERROR(f"Failed {rel}: {exc}"))

        clear_media_exists_cache()
        self.stdout.write("")
        self.stdout.write(
            f"examined={examined} uploaded={uploaded} already_on_s3={skipped} failed={failed}"
            + (" (dry-run)" if dry else "")
        )
        location = getattr(settings, "AWS_LOCATION", "") or ""
        self.stdout.write(
            f"Bucket={settings.AWS_STORAGE_BUCKET_NAME} location={location!r} "
            f"endpoint={settings.AWS_S3_ENDPOINT_URL}"
        )

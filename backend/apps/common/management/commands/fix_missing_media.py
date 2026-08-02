"""
Audit and repair FileField/ImageField paths that point at missing files.

Strategy:
1. Ensure shared placeholder PNG exists.
2. Restore known legacy aliases (e.g. iic_logo.jpg ← IIC.jpg).
3. For each DB media path that is missing, recreate the file at that exact path
   (copy of placeholder) so public URLs keep working — no migration required.
4. Optionally unpublish rows that still cannot be repaired.

Usage:
  python manage.py fix_missing_media
  python manage.py fix_missing_media --dry-run
  python manage.py fix_missing_media --unpublish-broken
"""

from __future__ import annotations

import shutil

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db.models import FileField, ImageField

from apps.common.media_utils import (
    abs_media_path,
    ensure_placeholder,
    media_file_exists,
    restore_aliased_files,
)


class Command(BaseCommand):
    help = "Restore aliased / missing media files referenced by the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report only; do not write files or update the database.",
        )
        parser.add_argument(
            "--unpublish-broken",
            action="store_true",
            help="If a model has is_published and the file is still missing after fix, set is_published=False.",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        unpublish = options["unpublish_broken"]

        if dry:
            self.stdout.write("[dry-run] would ensure placeholder + restore media aliases")
        else:
            ph = ensure_placeholder()
            self.stdout.write(self.style.SUCCESS(f"Placeholder ready: {ph}"))
            restored = restore_aliased_files()
            for rel in restored:
                self.stdout.write(self.style.SUCCESS(f"Restored alias file: {rel}"))
            if not restored:
                self.stdout.write("No alias files needed restoring.")

        checked = 0
        missing = 0
        restored_paths = 0
        unpublished = 0
        still_broken: list[str] = []

        for model in apps.get_models():
            fields = [f for f in model._meta.local_fields if isinstance(f, (FileField, ImageField))]
            if not fields:
                continue

            for obj in model.objects.all().iterator():
                row_missing = False
                for field in fields:
                    val = getattr(obj, field.name)
                    name = getattr(val, "name", "") or ""
                    if not name:
                        continue
                    checked += 1
                    if media_file_exists(name):
                        continue
                    missing += 1
                    row_missing = True
                    label = f"{model._meta.label} pk={obj.pk} {field.name}={name}"
                    self.stdout.write(self.style.WARNING(f"Missing: {label}"))

                    if dry:
                        still_broken.append(label)
                        continue

                    # Recreate the exact relative path so existing API/HTML URLs keep working
                    dest = abs_media_path(name)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ensure_placeholder(), dest)
                    restored_paths += 1
                    self.stdout.write(self.style.SUCCESS(f"  -> restored file at {name}"))

                if (
                    not dry
                    and unpublish
                    and row_missing
                    and hasattr(obj, "is_published")
                    and obj.is_published
                ):
                    # Only unpublish if still missing after restore attempt
                    still = False
                    for field in fields:
                        val = getattr(obj, field.name)
                        name = getattr(val, "name", "") or ""
                        if name and not media_file_exists(name):
                            still = True
                            break
                    if still:
                        obj.is_published = False
                        obj.save(update_fields=["is_published"])
                        unpublished += 1

                if not dry:
                    for field in fields:
                        val = getattr(obj, field.name)
                        name = getattr(val, "name", "") or ""
                        if name and not media_file_exists(name):
                            still_broken.append(
                                f"{model._meta.label} pk={obj.pk} {field.name}={name}"
                            )

        self.stdout.write("")
        self.stdout.write(
            f"Checked={checked} missing={missing} restored_files={restored_paths} unpublished={unpublished}"
        )
        if still_broken:
            self.stdout.write(self.style.ERROR(f"Still broken ({len(still_broken)}):"))
            for row in still_broken:
                self.stdout.write(f"  - {row}")
        else:
            self.stdout.write(self.style.SUCCESS("All media references resolve to existing files."))

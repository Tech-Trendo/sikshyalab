"""
Manually synchronize partners from the external API.

  python manage.py sync_partners
  python manage.py sync_partners --force
"""

from django.core.management.base import BaseCommand

from apps.cms.services.partner_sync import sync_partners


class Command(BaseCommand):
    help = (
        "Synchronize Partner rows from PARTNER_SYNC_API_URL. "
        "Skips if last successful sync was within the configured interval "
        "unless --force is passed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Ignore the 30-day interval and sync immediately.",
        )

    def handle(self, *args, **options):
        force = bool(options.get("force"))
        result = sync_partners(force=force)
        if result.skipped:
            self.stdout.write(self.style.WARNING(f"Skipped: {result.reason}"))
            return
        if result.errors and result.created == 0 and result.updated == 0 and result.deactivated == 0:
            self.stderr.write(self.style.ERROR(f"Sync failed: {result.errors}"))
            return
        self.stdout.write(
            self.style.SUCCESS(
                "Partner sync finished — "
                f"created={result.created} updated={result.updated} "
                f"deactivated={result.deactivated} unchanged={result.unchanged} "
                f"failed={result.failed}"
            )
        )
        for err in result.errors:
            self.stderr.write(self.style.WARNING(err))

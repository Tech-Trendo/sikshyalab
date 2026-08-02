"""
Seed the first Super Admin account (idempotent).

Usage:
  python manage.py seed_superadmin
  python manage.py seed_superadmin --email admin@shikshalab.io --password 'ChangeMe123!'
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import UserProfile, UserSettings
from apps.notifications.services import ensure_inbox_seeded, get_or_create_preferences

User = get_user_model()


class Command(BaseCommand):
    help = "Create the first Super Admin if none exists (or ensure the given email is admin)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default=getattr(settings, "SUPERADMIN_EMAIL", None) or "admin@shikshalab.io",
        )
        parser.add_argument(
            "--password",
            default=getattr(settings, "SUPERADMIN_PASSWORD", None) or "Admin@12345",
        )
        parser.add_argument("--first-name", default="Super")
        parser.add_argument("--last-name", default="Admin")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Update/reset the given email even if another admin already exists.",
        )

    def handle(self, *args, **options):
        email = options["email"].lower().strip()
        password = options["password"]
        first_name = options["first_name"]
        last_name = options["last_name"]
        force = options["force"]

        existing_admin = User.objects.filter(role=User.Role.ADMIN).first()
        user = User.objects.filter(email__iexact=email).first()

        if user is None and existing_admin is not None and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"Admin already exists ({existing_admin.email}). "
                    f"Use --force --email {email} to create/update this account."
                )
            )
            return

        if user is None:
            user = User.objects.create_superuser(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            user.must_change_password = False
            user.is_email_verified = True
            user.save(update_fields=["must_change_password", "is_email_verified", "updated_at"])
            created = True
        else:
            user.role = User.Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.is_active_account = True
            user.first_name = first_name or user.first_name
            user.last_name = last_name or user.last_name
            user.set_password(password)
            user.must_change_password = False
            user.save()
            created = False

        UserProfile.objects.get_or_create(user=user)
        UserSettings.objects.get_or_create(user=user)
        get_or_create_preferences(user)
        ensure_inbox_seeded(user)

        action = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} Super Admin: {user.email}"
            )
        )

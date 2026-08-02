"""Send a test email using current EMAIL_* / BREVO_API_KEY settings."""

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.emails import email_delivery_ready, send_email_message


class Command(BaseCommand):
    help = "Send a test email to verify SMTP / Brevo delivery."

    def add_arguments(self, parser):
        parser.add_argument("to_email", type=str, help="Recipient email address")

    def handle(self, *args, **options):
        to_email = options["to_email"].strip()
        if not to_email or "@" not in to_email:
            raise CommandError("Provide a valid recipient email.")

        ready, err = email_delivery_ready()
        if not ready:
            raise CommandError(
                f"Email is not configured: {err}\n\n"
                "Edit backend/.env and set either:\n"
                "  BREVO_API_KEY=xkeysib-...\n"
                "or:\n"
                "  EMAIL_HOST_USER=your-login@email.com\n"
                "  EMAIL_HOST_PASSWORD=your-smtp-key-or-gmail-app-password\n"
                "  DEFAULT_FROM_EMAIL=ShikshaLab <your-login@email.com>\n"
                "Then restart runserver."
            )

        ok, send_err = send_email_message(
            to_email=to_email,
            subject="ShikshaLab test email",
            text=(
                "This is a test email from ShikshaLab.\n"
                "If you received this, outbound email is configured correctly.\n"
            ),
        )
        if not ok:
            raise CommandError(f"Send failed: {send_err}")
        self.stdout.write(self.style.SUCCESS(f"Test email sent to {to_email}"))

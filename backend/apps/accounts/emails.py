"""Account email helpers (welcome credentials + password reset)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.mail import get_connection, send_mail

logger = logging.getLogger(__name__)

_ENV_PATH = Path(settings.BASE_DIR) / ".env"


def _read_dotenv(key: str) -> str | None:
    """Read a single key from backend/.env so email creds update without full restart."""
    try:
        if not _ENV_PATH.is_file():
            return None
        for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
            trimmed = line.strip()
            if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
                continue
            k, _, v = trimmed.partition("=")
            if k.strip() != key:
                continue
            value = v.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            return value
    except OSError:
        return None
    return None


def _env(key: str, fallback: str = "") -> str:
    live = _read_dotenv(key)
    if live is not None and live != "":
        return live
    return str(getattr(settings, key, fallback) or fallback).strip()


def _is_console_or_dummy_backend() -> bool:
    backend = (_env("EMAIL_BACKEND", getattr(settings, "EMAIL_BACKEND", "")) or "").lower()
    return "console.emailbackend" in backend or "dummy.emailbackend" in backend


def _looks_like_placeholder(value: str) -> bool:
    v = (value or "").strip().lower()
    if not v:
        return True
    if v.startswith("your-"):
        return True
    if "example.com" in v:
        return True
    if v in {
        "your-gmail@gmail.com",
        "your-app-password-here",
        "your-smtp-key",
        "your-brevo-smtp-key",
        "your-email@example.com",
        "your-brevo-login-email@example.com",
        "xsmtpsib-xxxxxxxx",
        "change-me",
    }:
        return True
    return False


def _brevo_api_key() -> str:
    return _env("BREVO_API_KEY")


def _smtp_credentials() -> tuple[str, str, str]:
    user = _env("EMAIL_HOST_USER")
    password = _env("EMAIL_HOST_PASSWORD")
    host = _env("EMAIL_HOST")
    return user, password, host


def email_delivery_ready() -> tuple[bool, str]:
    """
    Return (ok, error_message).
    Prefers Brevo API key; otherwise requires real SMTP user/password.
    """
    api_key = _brevo_api_key()
    if api_key and not _looks_like_placeholder(api_key):
        return True, ""

    if _is_console_or_dummy_backend():
        return False, (
            "EMAIL_BACKEND is console/dummy. Set SMTP in backend/.env or set BREVO_API_KEY."
        )

    user, password, host = _smtp_credentials()
    if _looks_like_placeholder(user):
        return False, (
            "Set BREVO_API_KEY or real EMAIL_HOST_USER in backend/.env "
            "(current value is empty/placeholder)."
        )
    if _looks_like_placeholder(password):
        return False, (
            "Set EMAIL_HOST_PASSWORD in backend/.env to your Brevo SMTP key "
            "or mailbox password (current value is placeholder)."
        )
    if not host or host.lower() in {"localhost", "smtp.example.com"}:
        return False, "EMAIL_HOST is not a real SMTP server in backend/.env"
    return True, ""


def _smtp_not_configured() -> str | None:
    ok, err = email_delivery_ready()
    return None if ok else err


def _frontend_url() -> str:
    return (
        _env("FRONTEND_URL", getattr(settings, "FRONTEND_URL", "http://localhost:8081"))
        or "http://localhost:8081"
    ).rstrip("/")


def _from_email() -> str:
    """
    Prefer DEFAULT_FROM_EMAIL, but if it is an unverified placeholder domain,
    fall back to EMAIL_HOST_USER (required by Brevo/Gmail).
    """
    configured = _env("DEFAULT_FROM_EMAIL", getattr(settings, "DEFAULT_FROM_EMAIL", ""))
    user, _, _ = _smtp_credentials()
    configured_l = configured.lower()
    if (
        not configured
        or "noreply@shikshalab.com" in configured_l
        or "example.com" in configured_l
        or _looks_like_placeholder(configured)
    ):
        if user and not _looks_like_placeholder(user):
            return f"ShikshaLab <{user}>"
        return configured or "noreply@shikshalab.com"
    return configured


def _smtp_bool(key: str, default: bool) -> bool:
    raw = (_env(key, str(getattr(settings, key, default))) or str(default)).lower()
    return raw in {"1", "true", "yes", "on"}


def _smtp_timeout() -> int:
    return int(_env("EMAIL_TIMEOUT", str(getattr(settings, "EMAIL_TIMEOUT", 20))) or 20)


def _smtp_connection():
    """Build SMTP connection from primary EMAIL_* settings only (no fallbacks)."""
    user, password, host = _smtp_credentials()
    port = int(_env("EMAIL_PORT", str(getattr(settings, "EMAIL_PORT", 587))) or 587)
    use_tls = _smtp_bool("EMAIL_USE_TLS", True)
    use_ssl = _smtp_bool("EMAIL_USE_SSL", False)
    if use_ssl:
        use_tls = False
    return get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=host,
        port=port,
        username=user,
        password=password,
        use_tls=use_tls,
        use_ssl=use_ssl,
        timeout=_smtp_timeout(),
    )


def _send_via_brevo_api(*, to_email: str, subject: str, text: str) -> tuple[bool, str]:
    api_key = _brevo_api_key()
    if not api_key or _looks_like_placeholder(api_key):
        return False, "BREVO_API_KEY not configured"

    from_addr = _from_email()
    # Brevo expects email + optional name
    sender_email = from_addr
    sender_name = "ShikshaLab"
    if "<" in from_addr and ">" in from_addr:
        # "Name <email@x.com>"
        sender_name = from_addr.split("<", 1)[0].strip().strip('"') or "ShikshaLab"
        sender_email = from_addr.split("<", 1)[1].split(">", 1)[0].strip()

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text,
    }
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if 200 <= resp.status < 300:
                return True, ""
            body = resp.read().decode("utf-8", errors="replace")
            return False, f"Brevo API HTTP {resp.status}: {body[:300]}"
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return False, f"Brevo API HTTP {exc.code}: {body[:300]}"
    except Exception as exc:
        return False, str(exc) or "Brevo API send failed"


def _send_via_smtp(*, to_email: str, subject: str, text: str) -> tuple[bool, str]:
    try:
        send_mail(
            subject,
            text,
            _from_email(),
            [to_email],
            fail_silently=False,
            connection=_smtp_connection(),
        )
        return True, ""
    except Exception as exc:
        logger.exception("SMTP send failed to %s", to_email)
        msg = str(exc) or "SMTP send failed"
        low = msg.lower()
        if "authentication" in low or "535" in msg or "incorrect authentication" in low:
            return False, (
                "SMTP login failed — check EMAIL_HOST_USER / EMAIL_HOST_PASSWORD in backend/.env."
            )
        if "timed out" in low or "10060" in msg or "unreachable" in low or "winerror" in low:
            host = _smtp_credentials()[2] or "EMAIL_HOST"
            return False, (
                f"Cannot reach SMTP server {host} from this machine (connection timeout)."
            )
        return False, msg


def send_email_message(*, to_email: str, subject: str, text: str) -> tuple[bool, str]:
    """Send using Brevo API if configured, else Django SMTP."""
    ready, err = email_delivery_ready()
    if not ready:
        logger.warning("Email skipped for %s: %s", to_email, err)
        return False, err

    api_key = _brevo_api_key()
    if api_key and not _looks_like_placeholder(api_key):
        return _send_via_brevo_api(to_email=to_email, subject=subject, text=text)

    return _send_via_smtp(to_email=to_email, subject=subject, text=text)


def send_account_credentials_email(
    *,
    email: str,
    temporary_password: str,
    role: str,
    name: str = "",
) -> tuple[bool, str]:
    """
    Email login credentials after an admin creates an account.

    Returns (ok, error_message). error_message is empty on success.
    """
    login_url = f"{_frontend_url()}/login"
    display = name.strip() or email
    subject = "Your ShikshaLab account"
    body = (
        f"Hello {display},\n\n"
        f"An administrator created a {role.title()} account for you on ShikshaLab.\n\n"
        f"Login credentials:\n"
        f"Email: {email}\n"
        f"Temporary password: {temporary_password}\n\n"
        f"Sign in at: {login_url}\n"
        f"You will be asked to change your password on first login.\n\n"
        f"— ShikshaLab"
    )
    return send_email_message(to_email=email, subject=subject, text=body)


def send_password_reset_email(*, email: str, token: str, name: str = "") -> bool:
    reset_url = f"{_frontend_url()}/reset-password?token={token}"
    display = name.strip() or email
    subject = "Reset your ShikshaLab password"
    body = (
        f"Hello {display},\n\n"
        f"We received a request to reset your ShikshaLab password.\n\n"
        f"Open this link to choose a new password (valid for 1 hour):\n"
        f"{reset_url}\n\n"
        f"If you did not request this, you can ignore this email.\n\n"
        f"— ShikshaLab"
    )
    ok, _err = send_email_message(to_email=email, subject=subject, text=body)
    return ok


def send_password_reset_otp_email(
    *,
    email: str,
    otp: str,
    expires_minutes: int = 10,
    name: str = "",
) -> bool:
    display = name.strip() or email
    subject = "Your ShikshaLab verification code"
    body = (
        f"Hello {display},\n\n"
        f"Your password reset verification code is:\n\n"
        f"    {otp}\n\n"
        f"This code expires in {expires_minutes} minutes.\n\n"
        f"Security notice: Never share this code with anyone. "
        f"ShikshaLab staff will never ask for your OTP.\n\n"
        f"If you did not request a password reset, you can ignore this email.\n\n"
        f"— ShikshaLab"
    )
    ok, _err = send_email_message(to_email=email, subject=subject, text=body)
    return ok


def send_password_changed_email(*, email: str, name: str = "") -> bool:
    display = name.strip() or email
    subject = "Your ShikshaLab password was changed"
    body = (
        f"Hello {display},\n\n"
        f"Your password has been changed successfully.\n\n"
        f"If this wasn't you, contact support immediately and secure your account.\n\n"
        f"— ShikshaLab"
    )
    ok, _err = send_email_message(to_email=email, subject=subject, text=body)
    return ok


def send_event_registration_approved_email(
    *,
    email: str,
    name: str,
    event_title: str,
    event_location: str,
    event_start,
    event_end=None,
    event_description: str = "",
    event_slug: str = "",
) -> bool:
    """Email event details after an admin approves a registration."""
    display = name.strip() or email
    start_str = (
        event_start.strftime("%A, %d %B %Y · %I:%M %p")
        if hasattr(event_start, "strftime")
        else str(event_start)
    )
    end_str = ""
    if event_end and hasattr(event_end, "strftime"):
        end_str = event_end.strftime("%I:%M %p")

    site_url = getattr(settings, "PUBLIC_SITE_URL", None) or getattr(
        settings, "FRONTEND_URL", "http://localhost:3000"
    )
    details_url = f"{site_url.rstrip('/')}/events/{event_slug}" if event_slug else site_url

    subject = f"You're registered: {event_title}"
    body_lines = [
        f"Hello {display},",
        "",
        "Your registration has been approved. Here are the event details:",
        "",
        f"Event: {event_title}",
        f"When: {start_str}" + (f" – {end_str}" if end_str else ""),
        f"Where: {event_location or 'TBA'}",
    ]
    if event_description:
        body_lines.extend(["", "About the event:", event_description.strip()])
    body_lines.extend(
        [
            "",
            f"View online: {details_url}",
            "",
            "We look forward to seeing you!",
            "",
            "— ShikshaLab",
        ]
    )
    ok, _err = send_email_message(to_email=email, subject=subject, text="\n".join(body_lines))
    return ok

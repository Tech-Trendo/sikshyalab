"""
Shared utility helpers for ShikshaLab.
"""

import secrets
import string
import uuid
from datetime import datetime

from django.utils import timezone
from django.utils.text import slugify


def generate_unique_code(
    prefix: str = "",
    length: int = 8,
    alphabet: str = string.ascii_uppercase + string.digits,
    separator: str = "-",
) -> str:
    """
    Generate a unique-looking alphanumeric code.

    Example: ``generate_unique_code('INV', 8)`` → ``INV-A3K9P2QX``
    """
    if length < 1:
        raise ValueError("length must be >= 1")
    token = "".join(secrets.choice(alphabet) for _ in range(length))
    if prefix:
        return f"{prefix}{separator}{token}"
    return token


def generate_uuid_code(prefix: str = "", short: bool = True) -> str:
    """
    Generate a UUID-based code.

    When ``short`` is True, returns the first 8 hex chars of a UUID4.
    """
    value = uuid.uuid4().hex
    body = value[:8].upper() if short else value.upper()
    return f"{prefix}-{body}" if prefix else body


def generate_sequential_code(
    prefix: str,
    sequence: int,
    width: int = 5,
    include_date: bool = True,
    separator: str = "-",
) -> str:
    """
    Build a human-readable sequential code.

    Example: ``generate_sequential_code('STU', 42)`` → ``STU-20260719-00042``
    """
    parts = [prefix.upper()]
    if include_date:
        parts.append(timezone.now().strftime("%Y%m%d"))
    parts.append(str(sequence).zfill(width))
    return separator.join(parts)


def generate_slug_code(text: str, max_length: int = 50, fallback: str = "item") -> str:
    """Slugify text and append a short unique suffix."""
    base = slugify(text)[: max_length - 9] or fallback
    suffix = uuid.uuid4().hex[:8]
    return f"{base}-{suffix}"


def generate_otp(length: int = 6) -> str:
    """Generate a numeric one-time password."""
    if length < 4:
        raise ValueError("OTP length must be at least 4")
    return "".join(secrets.choice(string.digits) for _ in range(length))


def now_iso() -> str:
    """Return the current timezone-aware datetime as ISO-8601."""
    return timezone.now().isoformat()


def parse_date(value, fmt: str = "%Y-%m-%d"):
    """Parse a date string; return None on failure."""
    if not value:
        return None
    if hasattr(value, "year"):
        return value
    try:
        return datetime.strptime(str(value), fmt).date()
    except (TypeError, ValueError):
        return None

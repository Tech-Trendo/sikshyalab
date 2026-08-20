"""Google reCAPTCHA (v2 checkbox) server-side verification via Siteverify.

Uses the classic Siteverify API (compatible with standard reCAPTCHA v2 keys).
Enterprise CreateAssessment is optional and not required for these keys.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def recaptcha_configured() -> bool:
    return bool((getattr(settings, "RECAPTCHA_SECRET_KEY", "") or "").strip())


def recaptcha_site_key() -> str:
    return (getattr(settings, "RECAPTCHA_SITE_KEY", "") or "").strip()


def client_ip_from_request(request) -> str | None:
    if request is None:
        return None
    forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.META.get("REMOTE_ADDR") or None


def verify_recaptcha_token(
    token: str | None,
    *,
    remote_ip: str | None = None,
) -> tuple[bool, str]:
    """
    Verify a client token with Google Siteverify.

    Returns (ok, error_message). When reCAPTCHA is not configured, returns (True, "").
    """
    if not recaptcha_configured():
        return True, ""

    raw = (token or "").strip()
    if not raw:
        return False, "Please complete the reCAPTCHA challenge."

    secret = settings.RECAPTCHA_SECRET_KEY.strip()
    payload: dict[str, Any] = {"secret": secret, "response": raw}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        encoded = urllib.parse.urlencode(payload).encode("utf-8")
        req = urllib.request.Request(
            SITEVERIFY_URL,
            data=encoded,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        logger.exception("recaptcha.siteverify_request_failed")
        return False, "Could not verify reCAPTCHA. Please try again."

    if not data.get("success"):
        codes = data.get("error-codes") or []
        logger.warning("recaptcha.siteverify_failed codes=%s", codes)
        return False, "reCAPTCHA verification failed. Please try again."

    # Optional v3 score gate (ignored for v2 checkbox responses).
    min_score = float(getattr(settings, "RECAPTCHA_MIN_SCORE", 0.0) or 0.0)
    if min_score > 0 and "score" in data:
        score = float(data.get("score") or 0)
        if score < min_score:
            logger.warning("recaptcha.low_score score=%s min=%s", score, min_score)
            return False, "reCAPTCHA score too low. Please try again."

    return True, ""


def require_recaptcha(attrs: dict, request) -> None:
    """Pop ``recaptcha_token`` from attrs and raise ValidationError if invalid."""
    from rest_framework import serializers

    token = attrs.pop("recaptcha_token", None)
    ok, message = verify_recaptcha_token(
        token,
        remote_ip=client_ip_from_request(request),
    )
    if not ok:
        raise serializers.ValidationError({"recaptcha_token": message})

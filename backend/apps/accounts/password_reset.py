"""
Secure OTP-based password reset service.

Never reveals whether an email/phone is registered.
OTP is stored hashed; plain OTP exists only in transit (email/SMS).
"""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import (
    OTPVerification,
    PasswordResetAudit,
    PasswordResetRequest,
    PasswordResetToken,
)

logger = logging.getLogger(__name__)
User = get_user_model()

GENERIC_REQUEST_MESSAGE = (
    "If an account exists with the provided information, a verification code has been sent."
)
GENERIC_OTP_FAIL = "Invalid or expired verification code."
GENERIC_TOKEN_FAIL = "Invalid or expired reset token."


def _cfg(name: str, default):
    return getattr(settings, name, default)


def otp_expiry_minutes() -> int:
    return int(_cfg("PASSWORD_RESET_OTP_EXPIRY_MINUTES", 10))


def otp_max_attempts() -> int:
    return int(_cfg("PASSWORD_RESET_OTP_MAX_ATTEMPTS", 5))


def lockout_threshold() -> int:
    return int(_cfg("PASSWORD_RESET_LOCKOUT_ATTEMPTS", 5))


def lockout_minutes() -> int:
    return int(_cfg("PASSWORD_RESET_LOCKOUT_MINUTES", 30))


def reset_token_minutes() -> int:
    return int(_cfg("PASSWORD_RESET_TOKEN_EXPIRY_MINUTES", 15))


def hash_otp(otp: str) -> str:
    secret = settings.SECRET_KEY
    return hashlib.sha256(f"{otp}:{secret}".encode("utf-8")).hexdigest()


def generate_otp() -> str:
    # Cryptographically secure 6-digit OTP (000000–999999)
    return f"{secrets.randbelow(1_000_000):06d}"


def normalize_identifier(raw: str) -> tuple[str, str]:
    """
    Returns (normalized_identifier, channel).
    Channel is EMAIL or SMS.
    """
    value = (raw or "").strip()
    if "@" in value:
        return value.lower(), PasswordResetRequest.Channel.EMAIL
    # Digits-only phone (allow leading +)
    phone = re.sub(r"[^\d+]", "", value)
    if phone.startswith("+"):
        digits = "+" + re.sub(r"\D", "", phone[1:])
    else:
        digits = re.sub(r"\D", "", phone)
    if len(re.sub(r"\D", "", digits)) < 7:
        raise ValueError("Enter a valid email address or registered phone number.")
    return digits, PasswordResetRequest.Channel.SMS


def resolve_user(identifier: str, channel: str):
    if channel == PasswordResetRequest.Channel.EMAIL:
        return User.objects.filter(email__iexact=identifier, is_active=True).first()
    # Phone match — try exact and without leading +
    qs = User.objects.filter(is_active=True, phone__isnull=False).exclude(phone="")
    user = qs.filter(phone=identifier).first()
    if user:
        return user
    digits = re.sub(r"\D", "", identifier)
    for candidate in qs.iterator():
        if re.sub(r"\D", "", candidate.phone or "") == digits:
            return candidate
    return None


def _client_meta(request) -> tuple[str | None, str]:
    if request is None:
        return None, ""
    ip = None
    try:
        from apps.accounts.activity import get_client_ip

        ip = get_client_ip(request)
    except Exception:
        ip = request.META.get("REMOTE_ADDR")
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]
    return ip, ua


def _audit(*, user, reset_request, action, detail="", request=None, metadata=None):
    ip, ua = _client_meta(request)
    PasswordResetAudit.objects.create(
        user=user,
        reset_request=reset_request,
        action=action,
        detail=detail,
        ip_address=ip,
        user_agent=ua,
        metadata=metadata or {},
    )


def _queue_otp_delivery(otp_id: str, plain_otp: str) -> None:
    try:
        from apps.accounts.tasks import deliver_password_reset_otp

        deliver_password_reset_otp.delay(str(otp_id), plain_otp)
    except Exception:
        logger.debug("Celery unavailable; delivering OTP inline")
        deliver_otp_inline(str(otp_id), plain_otp)


def deliver_otp_inline(otp_id: str, plain_otp: str) -> bool:
    from apps.accounts.emails import send_password_reset_otp_email

    try:
        otp = OTPVerification.objects.select_related("reset_request", "reset_request__user").get(
            pk=otp_id
        )
    except OTPVerification.DoesNotExist:
        return False
    req = otp.reset_request
    user = req.user
    if not user:
        return False
    minutes = otp_expiry_minutes()
    if req.channel == PasswordResetRequest.Channel.EMAIL:
        return send_password_reset_otp_email(
            email=user.email,
            name=user.get_full_name(),
            otp=plain_otp,
            expires_minutes=minutes,
        )
    # SMS future-ready: log + optional hook
    logger.info("SMS OTP delivery stub for user=%s (not configured)", user.pk)
    return True


@transaction.atomic
def request_password_reset(*, identifier: str, request=None) -> dict:
    """
    Start reset flow. Always returns the same public message.
    Includes ``request_id`` so the client can proceed to OTP entry
    without revealing whether the account existed (dummy id when unknown).
    """
    try:
        normalized, channel = normalize_identifier(identifier)
    except ValueError as exc:
        raise ValueError(str(exc)) from exc

    ip, ua = _client_meta(request)
    user = resolve_user(normalized, channel)
    now = timezone.now()
    expires = now + timedelta(minutes=otp_expiry_minutes())

    # Rate limit per identifier via recent pending requests
    recent = PasswordResetRequest.objects.filter(
        identifier=normalized,
        created_at__gte=now - timedelta(minutes=1),
    ).count()
    if recent >= 3:
        # Still return generic success shape with last request id if any
        last = (
            PasswordResetRequest.objects.filter(identifier=normalized)
            .order_by("-created_at")
            .first()
        )
        return {
            "detail": GENERIC_REQUEST_MESSAGE,
            "request_id": str(last.id) if last else None,
            "expires_in_seconds": otp_expiry_minutes() * 60,
            "channel": channel,
        }

    reset_req = PasswordResetRequest.objects.create(
        user=user,
        identifier=normalized,
        channel=channel,
        status=PasswordResetRequest.Status.PENDING,
        expires_at=expires,
        ip_address=ip,
        user_agent=ua,
    )
    _audit(
        user=user,
        reset_request=reset_req,
        action=PasswordResetAudit.Action.REQUESTED,
        request=request,
    )

    if user is None:
        # Create a decoy request id path — no OTP sent
        reset_req.status = PasswordResetRequest.Status.OTP_SENT
        reset_req.save(update_fields=["status", "updated_at"])
        return {
            "detail": GENERIC_REQUEST_MESSAGE,
            "request_id": str(reset_req.id),
            "expires_in_seconds": otp_expiry_minutes() * 60,
            "channel": channel,
        }

    if reset_req.locked_until and reset_req.locked_until > now:
        return {
            "detail": GENERIC_REQUEST_MESSAGE,
            "request_id": str(reset_req.id),
            "expires_in_seconds": otp_expiry_minutes() * 60,
            "channel": channel,
        }

    plain = generate_otp()
    otp = OTPVerification.objects.create(
        reset_request=reset_req,
        otp_hash=hash_otp(plain),
        expires_at=expires,
        max_attempts=otp_max_attempts(),
        status=OTPVerification.Status.PENDING,
    )
    reset_req.status = PasswordResetRequest.Status.OTP_SENT
    reset_req.save(update_fields=["status", "updated_at"])
    _audit(
        user=user,
        reset_request=reset_req,
        action=PasswordResetAudit.Action.OTP_SENT,
        request=request,
        detail=f"OTP queued via {channel}",
    )
    _queue_otp_delivery(otp.id, plain)
    return {
        "detail": GENERIC_REQUEST_MESSAGE,
        "request_id": str(reset_req.id),
        "expires_in_seconds": otp_expiry_minutes() * 60,
        "channel": channel,
    }


@transaction.atomic
def resend_otp(*, request_id: str, request=None) -> dict:
    try:
        reset_req = PasswordResetRequest.objects.select_related("user").get(pk=request_id)
    except (PasswordResetRequest.DoesNotExist, ValueError):
        return {
            "detail": GENERIC_REQUEST_MESSAGE,
            "expires_in_seconds": otp_expiry_minutes() * 60,
        }

    now = timezone.now()
    if reset_req.locked_until and reset_req.locked_until > now:
        return {
            "detail": GENERIC_REQUEST_MESSAGE,
            "expires_in_seconds": otp_expiry_minutes() * 60,
        }

    # Invalidate previous pending OTPs
    OTPVerification.objects.filter(
        reset_request=reset_req,
        status=OTPVerification.Status.PENDING,
    ).update(status=OTPVerification.Status.EXPIRED)

    if not reset_req.user:
        return {
            "detail": GENERIC_REQUEST_MESSAGE,
            "request_id": str(reset_req.id),
            "expires_in_seconds": otp_expiry_minutes() * 60,
        }

    expires = now + timedelta(minutes=otp_expiry_minutes())
    plain = generate_otp()
    otp = OTPVerification.objects.create(
        reset_request=reset_req,
        otp_hash=hash_otp(plain),
        expires_at=expires,
        max_attempts=otp_max_attempts(),
        status=OTPVerification.Status.PENDING,
    )
    reset_req.expires_at = expires
    reset_req.status = PasswordResetRequest.Status.OTP_SENT
    reset_req.save(update_fields=["expires_at", "status", "updated_at"])
    _audit(
        user=reset_req.user,
        reset_request=reset_req,
        action=PasswordResetAudit.Action.OTP_RESENT,
        request=request,
    )
    _queue_otp_delivery(otp.id, plain)
    return {
        "detail": GENERIC_REQUEST_MESSAGE,
        "request_id": str(reset_req.id),
        "expires_in_seconds": otp_expiry_minutes() * 60,
        "channel": reset_req.channel,
    }


@transaction.atomic
def verify_otp(*, request_id: str, otp: str, request=None) -> dict:
    otp = (otp or "").strip()
    if not re.fullmatch(r"\d{6}", otp):
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    try:
        reset_req = PasswordResetRequest.objects.select_related("user").get(pk=request_id)
    except (PasswordResetRequest.DoesNotExist, ValueError):
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    now = timezone.now()
    if reset_req.locked_until and reset_req.locked_until > now:
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    pending = (
        OTPVerification.objects.filter(
            reset_request=reset_req,
            status=OTPVerification.Status.PENDING,
        )
        .order_by("-created_at")
        .first()
    )
    if pending is None:
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    if pending.expires_at <= now:
        pending.status = OTPVerification.Status.EXPIRED
        pending.save(update_fields=["status", "updated_at"])
        reset_req.status = PasswordResetRequest.Status.EXPIRED
        reset_req.save(update_fields=["status", "updated_at"])
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    pending.attempt_count += 1
    if pending.attempt_count > pending.max_attempts:
        pending.status = OTPVerification.Status.LOCKED
        pending.save(update_fields=["attempt_count", "status", "updated_at"])
        reset_req.status = PasswordResetRequest.Status.LOCKED
        reset_req.locked_until = now + timedelta(minutes=lockout_minutes())
        reset_req.failure_count += 1
        reset_req.save(
            update_fields=["status", "locked_until", "failure_count", "updated_at"]
        )
        _audit(
            user=reset_req.user,
            reset_request=reset_req,
            action=PasswordResetAudit.Action.LOCKED,
            request=request,
        )
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    if hash_otp(otp) != pending.otp_hash:
        pending.save(update_fields=["attempt_count", "updated_at"])
        reset_req.failure_count += 1
        updates = ["failure_count", "updated_at"]
        if reset_req.failure_count >= lockout_threshold():
            reset_req.status = PasswordResetRequest.Status.LOCKED
            reset_req.locked_until = now + timedelta(minutes=lockout_minutes())
            updates.extend(["status", "locked_until"])
            pending.status = OTPVerification.Status.LOCKED
            pending.save(update_fields=["attempt_count", "status", "updated_at"])
            _audit(
                user=reset_req.user,
                reset_request=reset_req,
                action=PasswordResetAudit.Action.LOCKED,
                request=request,
            )
        else:
            pending.save(update_fields=["attempt_count", "updated_at"])
            _audit(
                user=reset_req.user,
                reset_request=reset_req,
                action=PasswordResetAudit.Action.OTP_FAILED,
                request=request,
            )
        reset_req.save(update_fields=updates)
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    if not reset_req.user:
        return {"ok": False, "detail": GENERIC_OTP_FAIL}

    # Success — mark verified, invalidate other OTPs, issue temp token
    pending.status = OTPVerification.Status.VERIFIED
    pending.verified_at = now
    pending.save(update_fields=["status", "verified_at", "attempt_count", "updated_at"])
    OTPVerification.objects.filter(
        reset_request=reset_req,
        status=OTPVerification.Status.PENDING,
    ).exclude(pk=pending.pk).update(status=OTPVerification.Status.EXPIRED)

    reset_req.status = PasswordResetRequest.Status.VERIFIED
    reset_req.save(update_fields=["status", "updated_at"])

    token_value = secrets.token_urlsafe(32)
    token = PasswordResetToken.objects.create(
        user=reset_req.user,
        token=token_value,
        expires_at=now + timedelta(minutes=reset_token_minutes()),
        reset_request=reset_req,
    )
    _audit(
        user=reset_req.user,
        reset_request=reset_req,
        action=PasswordResetAudit.Action.OTP_VERIFIED,
        request=request,
    )
    _audit(
        user=reset_req.user,
        reset_request=reset_req,
        action=PasswordResetAudit.Action.TOKEN_ISSUED,
        request=request,
    )
    return {
        "ok": True,
        "detail": "Verification successful.",
        "reset_token": token.token,
        "expires_in_seconds": reset_token_minutes() * 60,
    }


def check_reset_token(token: str) -> dict:
    reset = (
        PasswordResetToken.objects.select_related("user")
        .filter(token=token)
        .first()
    )
    if reset is None or not reset.is_valid:
        return {"valid": False, "detail": GENERIC_TOKEN_FAIL}
    return {
        "valid": True,
        "email_hint": _mask_email(reset.user.email),
        "expires_at": reset.expires_at.isoformat(),
    }


def _mask_email(email: str) -> str:
    try:
        local, domain = email.split("@", 1)
        if len(local) <= 2:
            masked = local[0] + "***"
        else:
            masked = local[0] + "***" + local[-1]
        return f"{masked}@{domain}"
    except Exception:
        return "***"


@transaction.atomic
def complete_password_reset(*, token: str, new_password: str, request=None) -> dict:
    reset = (
        PasswordResetToken.objects.select_related("user", "reset_request")
        .filter(token=token)
        .first()
    )
    if reset is None or not reset.is_valid:
        return {"ok": False, "detail": GENERIC_TOKEN_FAIL}

    user = reset.user
    if check_password(new_password, user.password):
        return {
            "ok": False,
            "detail": "New password must be different from your current password.",
        }

    user.set_password(new_password)
    user.must_change_password = False
    user.provisional_password = ""
    user.save(
        update_fields=["password", "must_change_password", "provisional_password", "updated_at"]
    )

    now = timezone.now()
    # Invalidate all active reset tokens for this user
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
    if reset.reset_request_id:
        PasswordResetRequest.objects.filter(pk=reset.reset_request_id).update(
            status=PasswordResetRequest.Status.COMPLETED
        )
        OTPVerification.objects.filter(
            reset_request_id=reset.reset_request_id,
            status=OTPVerification.Status.PENDING,
        ).update(status=OTPVerification.Status.EXPIRED)

    # Optional: blacklist outstanding JWT refresh tokens is session-based;
    # force clients to re-login by relying on new password only.

    _audit(
        user=user,
        reset_request=reset.reset_request,
        action=PasswordResetAudit.Action.PASSWORD_RESET,
        request=request,
    )

    try:
        from apps.accounts.activity import log_activity

        log_activity(
            user,
            action="password_reset_completed",
            request=request,
            object_id=user.pk,
            object_repr=user.email,
        )
    except Exception:
        pass

    try:
        from apps.notifications.services import notify_password_changed

        notify_password_changed(user)
    except Exception:
        logger.exception("notify_password_changed failed after reset")

    try:
        from apps.accounts.emails import send_password_changed_email

        send_password_changed_email(email=user.email, name=user.get_full_name())
    except Exception:
        logger.exception("password changed confirmation email failed")

    return {
        "ok": True,
        "detail": "Password updated successfully. You can sign in now.",
    }

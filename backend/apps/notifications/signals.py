"""
Signal receivers that fan out domain events into notifications.

Uses apps.get_model / try-except so missing or incomplete apps do not break startup.

Hooks covered:
- Enrollment approved / activated (status → APPROVED or ACTIVE)
- Assignment created when status is PUBLISHED (or on create if already published)
- Payment created with SUCCESS status
- Certificate issued (when certificates.Certificate model exists)

Other apps may also call ``apps.notifications.services`` helpers directly
(preferred for explicit control from views/services).
"""

from __future__ import annotations

import logging

from django.apps import apps
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _connect_optional(model_label: str, handler, dispatch_uid: str):
    """Connect a post_save receiver if the model is registered."""
    try:
        model = apps.get_model(model_label)
    except LookupError:
        logger.debug("Model %s not available; skipping notification signal", model_label)
        return
    post_save.connect(handler, sender=model, dispatch_uid=dispatch_uid)


def _on_enrollment_saved(sender, instance, created, **kwargs):
    try:
        status = getattr(instance, "status", None)
        # Notify once when enrollment becomes operationally active
        # (approve_enrollment goes PENDING → APPROVED → ACTIVE).
        if status != "ACTIVE":
            return
        update_fields = kwargs.get("update_fields")
        if not created and update_fields is not None and "status" not in update_fields:
            return

        from apps.notifications.services import notify_enrollment_approved

        notify_enrollment_approved(instance)
    except Exception:
        logger.exception("Enrollment notification signal failed")


def _on_assignment_saved(sender, instance, created, **kwargs):
    try:
        status = getattr(instance, "status", None)
        if status != "PUBLISHED":
            return
        update_fields = kwargs.get("update_fields")
        # Fire when created as PUBLISHED, or when status is part of the update,
        # or on a full save (update_fields is None) — callers should prefer
        # apps.notifications.services.notify_assignment_created for precision.
        if not created and update_fields is not None and "status" not in update_fields:
            return

        from apps.notifications.services import notify_assignment_created

        notify_assignment_created(instance)
    except Exception:
        logger.exception("Assignment notification signal failed")

def _on_payment_saved(sender, instance, created, **kwargs):
    try:
        if not created:
            return
        if getattr(instance, "status", None) != "SUCCESS":
            return

        from apps.notifications.services import notify_payment_received

        notify_payment_received(instance)
    except Exception:
        logger.exception("Payment notification signal failed")


def _on_certificate_saved(sender, instance, created, **kwargs):
    try:
        status = getattr(instance, "status", None)
        update_fields = kwargs.get("update_fields")
        if status != "ISSUED":
            return
        if not created and update_fields is not None and "status" not in update_fields:
            return

        from apps.notifications.services import notify_certificate_issued

        notify_certificate_issued(instance)
    except Exception:
        logger.exception("Certificate notification signal failed")


def connect_notification_signals():
    """Called from AppConfig.ready()."""
    _connect_optional(
        "enrollments.Enrollment",
        _on_enrollment_saved,
        "notifications_enrollment_saved",
    )
    _connect_optional(
        "assignments.Assignment",
        _on_assignment_saved,
        "notifications_assignment_saved",
    )
    _connect_optional(
        "fees.Payment",
        _on_payment_saved,
        "notifications_payment_saved",
    )
    _connect_optional(
        "certificates.Certificate",
        _on_certificate_saved,
        "notifications_certificate_saved",
    )

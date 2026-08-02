"""Celery tasks for accounts (password-reset OTP delivery)."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    name="accounts.deliver_password_reset_otp",
)
def deliver_password_reset_otp(self, otp_id: str, plain_otp: str) -> bool:
    from apps.accounts.password_reset import deliver_otp_inline

    return deliver_otp_inline(otp_id, plain_otp)

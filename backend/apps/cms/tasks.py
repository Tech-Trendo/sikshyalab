"""Celery tasks for the CMS app."""

from celery import shared_task

from apps.cms.services.partner_sync import sync_partners


@shared_task(name="cms.sync_partners")
def sync_partners_task(force: bool = False):
    """
    Periodic partner sync.

    The task may run daily; the service itself enforces the 30-day interval
    and skips when a successful sync is still fresh.
    """
    result = sync_partners(force=bool(force))
    return result.as_dict()

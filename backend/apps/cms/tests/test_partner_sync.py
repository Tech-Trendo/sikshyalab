"""Tests for Partner synchronization workflow."""

from datetime import timedelta
from unittest.mock import MagicMock

from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from apps.cms.services.partner_sync import (
    ExternalPartnerPayload,
    PartnerSynchronizer,
    PartnerSyncResult,
)


class FakeStateStore:
    def __init__(self, last=None):
        self.last = last
        self.writes = []

    def get_last_successful_sync_at(self):
        return self.last

    def set_last_successful_sync_at(self, when):
        self.last = when
        self.writes.append(when)


class FakeClient:
    def __init__(self, partners=None, error=None):
        self.partners = partners or []
        self.error = error
        self.calls = 0

    def fetch_partners(self):
        self.calls += 1
        if self.error:
            raise self.error
        return list(self.partners)


class PartnerSyncIntervalTests(SimpleTestCase):
    def test_skips_when_synced_recently(self):
        store = FakeStateStore(last=timezone.now() - timedelta(days=5))
        sync = PartnerSynchronizer(
            client=FakeClient(),
            state_store=store,
            interval_days=30,
        )
        result = sync.run(force=False)
        self.assertTrue(result.skipped)
        self.assertEqual(store.writes, [])

    def test_runs_when_interval_elapsed(self):
        store = FakeStateStore(last=timezone.now() - timedelta(days=31))
        client = FakeClient(error=RuntimeError("api down"))
        sync = PartnerSynchronizer(
            client=client,
            state_store=store,
            interval_days=30,
        )
        result = sync.run(force=False)
        self.assertFalse(result.skipped)
        self.assertEqual(result.reason, "api_error")
        self.assertEqual(client.calls, 1)
        # Failure must not advance last sync timestamp
        self.assertEqual(store.writes, [])

    def test_force_ignores_interval(self):
        store = FakeStateStore(last=timezone.now())
        client = FakeClient(error=RuntimeError("api down"))
        sync = PartnerSynchronizer(
            client=client,
            state_store=store,
            interval_days=30,
        )
        result = sync.run(force=True)
        self.assertFalse(result.skipped)
        self.assertEqual(client.calls, 1)

    def test_payload_match_key_prefers_url(self):
        a = ExternalPartnerPayload(name="Acme", website_url="https://Acme.com/")
        b = ExternalPartnerPayload(name="Other", website_url="https://acme.com")
        self.assertEqual(a.match_key, b.match_key)

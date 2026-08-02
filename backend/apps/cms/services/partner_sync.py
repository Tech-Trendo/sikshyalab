"""
Partner synchronization — fetch from an external API every 30 days and
upsert into the local PostgreSQL Partner table.

Public site continues to read partners only from the local database.
"""

from __future__ import annotations

import hashlib
import json
import logging
import mimetypes
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import Any, Iterable, Optional, Protocol
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.cms.models import Partner

logger = logging.getLogger(__name__)

SYNC_INTERVAL_DAYS_DEFAULT = 30
CACHE_KEY_LAST_SYNC = "cms:partners:last_successful_sync_at"
STATE_FILENAME = "partner_sync_state.json"


# ---------------------------------------------------------------------------
# Value objects
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExternalPartnerPayload:
    """Normalized partner row from the external API."""

    name: str
    website_url: str = ""
    logo_url: str = ""
    order: int = 0
    external_id: str = ""

    @property
    def match_key(self) -> str:
        """Stable identity used to prevent duplicate Partner rows."""
        if self.external_id:
            return f"ext:{self.external_id.strip().lower()}"
        url = (self.website_url or "").strip().rstrip("/").lower()
        if url:
            return f"url:{url}"
        name = (self.name or "").strip().lower()
        return f"name:{name}"


@dataclass
class PartnerSyncResult:
    skipped: bool = False
    reason: str = ""
    created: int = 0
    updated: int = 0
    deactivated: int = 0
    unchanged: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "skipped": self.skipped,
            "reason": self.reason,
            "created": self.created,
            "updated": self.updated,
            "deactivated": self.deactivated,
            "unchanged": self.unchanged,
            "failed": self.failed,
            "errors": self.errors,
        }


# ---------------------------------------------------------------------------
# Ports (SOLID: depend on abstractions)
# ---------------------------------------------------------------------------


class PartnerApiClient(Protocol):
    def fetch_partners(self) -> list[ExternalPartnerPayload]:
        ...


class SyncStateStore(Protocol):
    def get_last_successful_sync_at(self):
        ...

    def set_last_successful_sync_at(self, when) -> None:
        ...


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PartnerSyncSettings:
    api_url: str
    api_timeout_seconds: int = 30
    interval_days: int = SYNC_INTERVAL_DAYS_DEFAULT
    api_token: str = ""

    @classmethod
    def from_django_settings(cls) -> "PartnerSyncSettings":
        return cls(
            api_url=str(getattr(settings, "PARTNER_SYNC_API_URL", "") or "").strip(),
            api_timeout_seconds=int(
                getattr(settings, "PARTNER_SYNC_API_TIMEOUT_SECONDS", 30) or 30
            ),
            interval_days=int(
                getattr(settings, "PARTNER_SYNC_INTERVAL_DAYS", SYNC_INTERVAL_DAYS_DEFAULT)
                or SYNC_INTERVAL_DAYS_DEFAULT
            ),
            api_token=str(getattr(settings, "PARTNER_SYNC_API_TOKEN", "") or "").strip(),
        )


# ---------------------------------------------------------------------------
# Sync state (durable without touching Partner model)
# ---------------------------------------------------------------------------


class DurablePartnerSyncStateStore:
    """
    Persist last successful sync timestamp via Django cache + local JSON file.
    Cache is fast; file survives cache flushes / worker restarts.
    """

    def __init__(self, state_dir: Optional[Path] = None):
        base = Path(getattr(settings, "BASE_DIR", Path.cwd()))
        self._state_path = (state_dir or (base / "var")) / STATE_FILENAME

    def get_last_successful_sync_at(self):
        cached = cache.get(CACHE_KEY_LAST_SYNC)
        if cached:
            return cached
        data = self._read_file()
        raw = data.get("last_successful_sync_at")
        if not raw:
            return None
        try:
            return timezone.datetime.fromisoformat(raw)
        except ValueError:
            return None

    def set_last_successful_sync_at(self, when) -> None:
        when = when or timezone.now()
        if timezone.is_naive(when):
            when = timezone.make_aware(when, timezone.get_current_timezone())
        cache.set(CACHE_KEY_LAST_SYNC, when, timeout=None)
        self._write_file({"last_successful_sync_at": when.isoformat()})

    def _read_file(self) -> dict:
        try:
            if not self._state_path.exists():
                return {}
            return json.loads(self._state_path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Could not read partner sync state file: %s", exc)
            return {}

    def _write_file(self, payload: dict) -> None:
        try:
            self._state_path.parent.mkdir(parents=True, exist_ok=True)
            self._state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Could not write partner sync state file: %s", exc)


# ---------------------------------------------------------------------------
# External API client
# ---------------------------------------------------------------------------


class HttpPartnerApiClient:
    """
    Fetches partner list from PARTNER_SYNC_API_URL.

    Expected JSON shapes (either):
      { "data": [ {...}, ... ] }
      { "partners": [ {...}, ... ] }
      [ {...}, ... ]

    Each item may include:
      name / title, website_url / website / url,
      logo_url / logo / image, order / position, id / external_id
    """

    def __init__(self, config: PartnerSyncSettings):
        self._config = config

    def fetch_partners(self) -> list[ExternalPartnerPayload]:
        if not self._config.api_url:
            raise RuntimeError("PARTNER_SYNC_API_URL is not configured.")

        headers = {"Accept": "application/json"}
        if self._config.api_token:
            headers["Authorization"] = f"Bearer {self._config.api_token}"

        response = requests.get(
            self._config.api_url,
            headers=headers,
            timeout=self._config.api_timeout_seconds,
        )
        response.raise_for_status()
        body = response.json()
        rows = self._extract_rows(body)
        partners: list[ExternalPartnerPayload] = []
        seen_keys: set[str] = set()
        for row in rows:
            payload = self._normalize_row(row)
            if not payload or not payload.name:
                continue
            if payload.match_key in seen_keys:
                continue
            seen_keys.add(payload.match_key)
            partners.append(payload)
        return partners

    @staticmethod
    def _extract_rows(body: Any) -> list[dict]:
        if isinstance(body, list):
            return [r for r in body if isinstance(r, dict)]
        if isinstance(body, dict):
            for key in ("data", "partners", "results", "items"):
                value = body.get(key)
                if isinstance(value, list):
                    return [r for r in value if isinstance(r, dict)]
        raise ValueError("External partner API returned an unrecognized payload shape.")

    @staticmethod
    def _normalize_row(row: dict) -> Optional[ExternalPartnerPayload]:
        name = str(row.get("name") or row.get("title") or "").strip()
        if not name:
            return None
        website = str(
            row.get("website_url") or row.get("website") or row.get("url") or ""
        ).strip()
        logo = str(
            row.get("logo_url") or row.get("logo") or row.get("image") or ""
        ).strip()
        try:
            order = int(row.get("order") if row.get("order") is not None else row.get("position") or 0)
        except (TypeError, ValueError):
            order = 0
        external_id = str(row.get("external_id") or row.get("id") or "").strip()
        return ExternalPartnerPayload(
            name=name[:200],
            website_url=website[:200] if website else "",
            logo_url=logo,
            order=max(0, order),
            external_id=external_id[:100],
        )


# ---------------------------------------------------------------------------
# Synchronizer
# ---------------------------------------------------------------------------


class PartnerSynchronizer:
    """
    Compare external partners with local Partner rows and upsert / deactivate.

    Inactive = is_published=False (no Partner model redesign).
    Matching prefers external_id (stored in order-stable hash via website/name),
    then website_url, then case-insensitive name.
    """

    def __init__(
        self,
        *,
        client: PartnerApiClient,
        state_store: SyncStateStore,
        interval_days: int = SYNC_INTERVAL_DAYS_DEFAULT,
    ):
        self._client = client
        self._state = state_store
        self._interval = timedelta(days=max(1, interval_days))

    def should_sync(self, *, force: bool = False) -> tuple[bool, str]:
        if force:
            return True, "forced"
        last = self._state.get_last_successful_sync_at()
        if last is None:
            return True, "never_synced"
        now = timezone.now()
        if timezone.is_naive(last):
            last = timezone.make_aware(last, timezone.get_current_timezone())
        elapsed = now - last
        if elapsed >= self._interval:
            return True, f"interval_elapsed ({elapsed.days}d)"
        remaining = self._interval - elapsed
        return False, f"synced_recently (retry in {remaining.days}d {remaining.seconds // 3600}h)"

    def run(self, *, force: bool = False) -> PartnerSyncResult:
        config_url = str(getattr(settings, "PARTNER_SYNC_API_URL", "") or "").strip()
        if not config_url:
            logger.info("Partner sync skipped: PARTNER_SYNC_API_URL is not configured.")
            return PartnerSyncResult(skipped=True, reason="not_configured")

        ok, reason = self.should_sync(force=force)
        if not ok:
            logger.info("Partner sync skipped: %s", reason)
            return PartnerSyncResult(skipped=True, reason=reason)

        try:
            remote = self._client.fetch_partners()
        except Exception as exc:
            logger.exception("Partner sync failed — external API error; local data unchanged.")
            result = PartnerSyncResult(skipped=False, reason="api_error", failed=1)
            result.errors.append(str(exc))
            return result

        try:
            result = self._apply(remote)
        except Exception as exc:
            logger.exception("Partner sync failed during DB apply; transaction rolled back.")
            result = PartnerSyncResult(skipped=False, reason="db_error", failed=1)
            result.errors.append(str(exc))
            return result

        self._state.set_last_successful_sync_at(timezone.now())
        logger.info(
            "Partner sync completed: created=%s updated=%s deactivated=%s unchanged=%s",
            result.created,
            result.updated,
            result.deactivated,
            result.unchanged,
        )
        return result

    @transaction.atomic
    def _apply(self, remote: Iterable[ExternalPartnerPayload]) -> PartnerSyncResult:
        result = PartnerSyncResult(reason="synced")
        remote_list = list(remote)
        remote_by_key = {p.match_key: p for p in remote_list}

        existing = list(Partner.objects.all())
        existing_by_key = {self._local_match_key(p): p for p in existing}

        # Upsert remote partners
        for key, payload in remote_by_key.items():
            partner = existing_by_key.get(key) or self._find_loose_match(existing, payload)
            try:
                if partner is None:
                    partner = self._create_partner(payload)
                    if partner is None:
                        result.failed += 1
                        result.errors.append(f"Skipped create (no logo): {payload.name}")
                        continue
                    result.created += 1
                    existing_by_key[self._local_match_key(partner)] = partner
                else:
                    changed = self._update_partner(partner, payload)
                    if changed:
                        result.updated += 1
                    else:
                        result.unchanged += 1
                    existing_by_key[self._local_match_key(partner)] = partner
            except Exception as exc:
                logger.exception("Failed to upsert partner %s", payload.name)
                result.failed += 1
                result.errors.append(f"{payload.name}: {exc}")

        # Deactivate local partners missing from remote (never hard-delete)
        active_keys = set(remote_by_key.keys())
        # Also mark keys of partners we matched loosely via name/url
        for payload in remote_list:
            matched = self._find_loose_match(existing, payload)
            if matched:
                active_keys.add(self._local_match_key(matched))

        for partner in Partner.objects.filter(is_published=True):
            key = self._local_match_key(partner)
            # Re-check against remote by name/url as well
            still_present = any(
                self._same_partner(partner, payload) for payload in remote_list
            )
            if still_present:
                continue
            if key in active_keys:
                continue
            partner.is_published = False
            partner.save(update_fields=["is_published", "updated_at"])
            result.deactivated += 1

        return result

    def _find_loose_match(
        self, existing: list[Partner], payload: ExternalPartnerPayload
    ) -> Optional[Partner]:
        url = (payload.website_url or "").strip().rstrip("/").lower()
        name = (payload.name or "").strip().lower()
        for partner in existing:
            if url and (partner.website_url or "").strip().rstrip("/").lower() == url:
                return partner
            if name and (partner.name or "").strip().lower() == name:
                return partner
        return None

    @staticmethod
    def _same_partner(partner: Partner, payload: ExternalPartnerPayload) -> bool:
        url = (payload.website_url or "").strip().rstrip("/").lower()
        name = (payload.name or "").strip().lower()
        if url and (partner.website_url or "").strip().rstrip("/").lower() == url:
            return True
        if name and (partner.name or "").strip().lower() == name:
            return True
        return False

    @staticmethod
    def _local_match_key(partner: Partner) -> str:
        url = (partner.website_url or "").strip().rstrip("/").lower()
        if url:
            return f"url:{url}"
        name = (partner.name or "").strip().lower()
        return f"name:{name}"

    def _create_partner(self, payload: ExternalPartnerPayload) -> Optional[Partner]:
        partner = Partner(
            name=payload.name,
            website_url=payload.website_url or "",
            order=payload.order,
            is_published=True,
        )
        logo_file = self._download_logo(payload)
        if logo_file is None:
            # Partner.logo is required — cannot create without a logo.
            return None
        filename, content = logo_file
        partner.logo.save(filename, content, save=False)
        partner.save()
        return partner

    def _update_partner(self, partner: Partner, payload: ExternalPartnerPayload) -> bool:
        changed_fields: list[str] = []
        if (partner.name or "") != payload.name:
            partner.name = payload.name
            changed_fields.append("name")
        if (partner.website_url or "") != (payload.website_url or ""):
            partner.website_url = payload.website_url or ""
            changed_fields.append("website_url")
        if partner.order != payload.order:
            partner.order = payload.order
            changed_fields.append("order")
        if not partner.is_published:
            partner.is_published = True
            changed_fields.append("is_published")

        logo_file = self._download_logo(payload)
        if logo_file is not None:
            filename, content = logo_file
            # Replace logo only when remote bytes differ (idempotent).
            new_hash = hashlib.sha256(content.read()).hexdigest()
            content.seek(0)
            old_hash = ""
            try:
                if partner.logo:
                    with partner.logo.open("rb") as fh:
                        old_hash = hashlib.sha256(fh.read()).hexdigest()
            except Exception:
                old_hash = ""
            if new_hash != old_hash:
                partner.logo.save(filename, content, save=False)
                changed_fields.append("logo")

        if not changed_fields:
            return False
        changed_fields.append("updated_at")
        partner.save(update_fields=list(dict.fromkeys(changed_fields)))
        return True

    def _download_logo(
        self, payload: ExternalPartnerPayload
    ) -> Optional[tuple[str, ContentFile]]:
        url = (payload.logo_url or "").strip()
        if not url or not url.startswith(("http://", "https://")):
            return None
        try:
            response = requests.get(url, timeout=20)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
            ext = mimetypes.guess_extension(content_type) or Path(urlparse(url).path).suffix or ".png"
            if ext == ".jpe":
                ext = ".jpg"
            safe_name = slugify(payload.name) or "partner"
            digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
            filename = f"{safe_name}-{digest}{ext}"
            return filename, ContentFile(response.content)
        except Exception as exc:
            logger.warning("Could not download logo for %s: %s", payload.name, exc)
            return None


# ---------------------------------------------------------------------------
# Facade
# ---------------------------------------------------------------------------


def build_default_synchronizer() -> PartnerSynchronizer:
    config = PartnerSyncSettings.from_django_settings()
    return PartnerSynchronizer(
        client=HttpPartnerApiClient(config),
        state_store=DurablePartnerSyncStateStore(),
        interval_days=config.interval_days,
    )


def sync_partners(*, force: bool = False) -> PartnerSyncResult:
    """
    Entry point for Celery / management command.

    - Skips when last successful sync was < interval days ago (unless force=True)
    - On API failure: leaves DB unchanged and logs the error
    - On success: upserts, deactivates missing, stores last sync timestamp
    """
    synchronizer = build_default_synchronizer()
    return synchronizer.run(force=force)

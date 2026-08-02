"""Channel registry — add SMS / push adapters without changing core dispatch."""

from __future__ import annotations

from typing import Protocol

from apps.notifications.constants import (
    CHANNEL_BROWSER,
    CHANNEL_EMAIL,
    CHANNEL_IN_APP,
    CHANNEL_PUSH,
    CHANNEL_SMS,
)


class ChannelAdapter(Protocol):
    channel: str

    def deliver(self, notification) -> bool: ...


_REGISTRY: dict[str, ChannelAdapter] = {}


def register_channel(adapter: ChannelAdapter) -> ChannelAdapter:
    _REGISTRY[adapter.channel] = adapter
    return adapter


def get_channel(channel: str) -> ChannelAdapter | None:
    return _REGISTRY.get((channel or "").upper())


def registered_channels() -> list[str]:
    return sorted(_REGISTRY.keys())


# Built-in channel identifiers (adapters register at import time in services)
CORE_CHANNELS = (
    CHANNEL_IN_APP,
    CHANNEL_EMAIL,
    CHANNEL_BROWSER,
    CHANNEL_SMS,
    CHANNEL_PUSH,
)

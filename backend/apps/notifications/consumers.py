"""Django Channels consumers for live notification delivery."""

from __future__ import annotations

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

from apps.notifications.services.websocket import user_group_name

logger = logging.getLogger(__name__)


@database_sync_to_async
def _user_from_token(token: str):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        access = AccessToken(token)
        user_id = access.get("user_id")
        return User.objects.get(pk=user_id, is_active=True)
    except Exception:
        return AnonymousUser()


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """
    Authenticate via:
      - query string ``?token=<jwt>``
      or first message ``{"type": "auth", "token": "..."}``
    """

    group_name: str | None = None

    async def connect(self):
        self.user = self.scope.get("user") or AnonymousUser()
        qs = self.scope.get("query_string", b"").decode()
        token = ""
        for part in qs.split("&"):
            if part.startswith("token="):
                token = part.split("=", 1)[1]
                break
        if token:
            self.user = await _user_from_token(token)

        if not getattr(self.user, "is_authenticated", False):
            # Accept then wait for auth message (some clients can't put JWT in URL)
            await self.accept()
            await self.send_json({"event": "auth.required"})
            return

        await self._join_group()
        await self.accept()
        await self.send_json({"event": "connected", "user_id": self.user.pk})

    async def _join_group(self):
        self.group_name = user_group_name(self.user.pk)
        await self.channel_layer.group_add(self.group_name, self.channel_name)

    async def disconnect(self, code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        msg_type = (content or {}).get("type") or (content or {}).get("event")
        if msg_type == "auth":
            token = (content or {}).get("token") or ""
            self.user = await _user_from_token(token)
            if not getattr(self.user, "is_authenticated", False):
                await self.send_json({"event": "auth.failed"})
                await self.close()
                return
            await self._join_group()
            await self.send_json({"event": "connected", "user_id": self.user.pk})
            return
        if msg_type == "ping":
            await self.send_json({"event": "pong"})

    async def notification_message(self, event):
        """Handler for channel_layer group_send type ``notification.message``."""
        payload = {k: v for k, v in event.items() if k != "type"}
        await self.send_json(payload)

"""
Enterprise notification module — architecture & production notes.

## Stack
- Models: Notification (+ soft delete, status, priority, event_code),
  NotificationPreference, NotificationTemplate, NotificationDelivery, NotificationLog
- Services: NotificationService, Email/Browser/WebSocket/Preference/Template/Analytics
- Async: Celery tasks (email, digests, retries, assignment reminders)
- Realtime: Django Channels at ``ws/notifications/?token=<jwt>``
- API: ``/api/v1/notifications/`` (+ preferences, templates, analytics, send, broadcast)

## Extending channels (SMS / Push)
1. Implement an adapter with ``channel`` + ``deliver(notification)``.
2. Register via ``channel_registry.register_channel``.
3. Queue from ``NotificationService.create(..., channels=["SMS"])``.

## Local run
```
# Terminal 1 — API + WebSocket (Daphne via runserver when daphne is installed)
python manage.py runserver 0.0.0.0:8000

# Terminal 2 — Celery worker
celery -A config worker -l info

# Terminal 3 — Celery beat (digests / reminders)
celery -A config beat -l info

python manage.py seed_notification_templates
```

## Production
- Set ``CHANNEL_LAYER_BACKEND=channels_redis.core.RedisChannelLayer``
- Run ASGI with Daphne/Uvicorn behind nginx (HTTP + WS upgrade on ``/ws/``)
- Run Celery worker + beat with Redis broker
- Use real ``EMAIL_BACKEND`` / Brevo; never block HTTP on SMTP
- Rate limit: ``notification_send`` throttle (60/hour)
- JWT on WebSocket query string — prefer short-lived access tokens; rotate regularly
- Monitor ``NotificationDelivery`` failures; beat retries hourly

## Security
- Object-level ownership on inbox APIs
- Teachers scoped to assigned batch students on ``/send/``
- Soft-delete + audit logs for compliance
- Preferences honored unless ``force=True`` (security/critical events)
"""

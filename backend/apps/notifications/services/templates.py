"""Template render / lookup service."""

from __future__ import annotations

from apps.notifications.models import NotificationTemplate


class NotificationTemplateService:
    @staticmethod
    def get_active(code: str, channel: str) -> NotificationTemplate | None:
        return (
            NotificationTemplate.objects.filter(
                code=(code or "").upper(),
                channel=(channel or "IN_APP").upper(),
                is_active=True,
            )
            .order_by("-updated_at")
            .first()
        )

    @staticmethod
    def render(code: str, channel: str, context: dict | None = None) -> dict | None:
        tpl = NotificationTemplateService.get_active(code, channel)
        if not tpl:
            return None
        rendered = tpl.render(context)
        return {
            "template": tpl,
            "title": rendered["title"],
            "message": rendered["message"],
            "subject": rendered["subject"],
            "notification_type": tpl.notification_type,
            "priority": tpl.default_priority,
        }

    @staticmethod
    def upsert(
        *,
        code: str,
        name: str,
        channel: str,
        title_template: str,
        body_template: str,
        notification_type: str = "SYSTEM",
        subject: str = "",
        default_priority: str = "MEDIUM",
        is_active: bool = True,
        metadata: dict | None = None,
    ) -> NotificationTemplate:
        code = code.upper()
        channel = channel.upper()
        existing = NotificationTemplate.objects.filter(code=code, channel=channel).first()
        if existing:
            existing.name = name
            existing.title_template = title_template
            existing.body_template = body_template
            existing.subject = subject
            existing.notification_type = notification_type
            existing.default_priority = default_priority
            existing.is_active = is_active
            existing.metadata = metadata or {}
            existing.save()
            return existing
        return NotificationTemplate.objects.create(
            code=code,
            name=name,
            channel=channel,
            title_template=title_template,
            body_template=body_template,
            subject=subject,
            notification_type=notification_type,
            default_priority=default_priority,
            is_active=is_active,
            metadata=metadata or {},
        )

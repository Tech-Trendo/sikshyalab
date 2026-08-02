"""Activity logging helpers for accounts (extracted from views; behavior unchanged)."""

from apps.accounts.models import ActivityLog


def get_client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_activity(user, action, module="accounts", request=None, **kwargs):
    ActivityLog.objects.create(
        user=user,
        action=action,
        module=module,
        object_id=str(kwargs.get("object_id", "")),
        object_repr=kwargs.get("object_repr", ""),
        ip_address=get_client_ip(request) if request else None,
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:1000] if request else ""),
        metadata=kwargs.get("metadata", {}),
    )

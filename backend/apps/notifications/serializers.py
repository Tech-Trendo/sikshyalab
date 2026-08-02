"""Serializers for notifications."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.notifications.models import (
    Notification,
    NotificationPreference,
    NotificationTemplate,
)

User = get_user_model()


class NotificationSerializer(serializers.ModelSerializer):
    link = serializers.CharField(source="action_url", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "uuid",
            "title",
            "message",
            "notification_type",
            "event_code",
            "channel",
            "priority",
            "status",
            "is_read",
            "is_archived",
            "read_at",
            "archived_at",
            "action_url",
            "link",
            "metadata",
            "related_object_type",
            "related_object_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "id",
            "email_enabled",
            "sms_enabled",
            "in_app_enabled",
            "browser_enabled",
            "digest_daily",
            "digest_weekly",
            "preferences",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = [
            "id",
            "code",
            "name",
            "channel",
            "notification_type",
            "subject",
            "title_template",
            "body_template",
            "default_priority",
            "is_active",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CreateNotificationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    message = serializers.CharField()
    notification_type = serializers.ChoiceField(
        choices=Notification.NotificationType.choices,
        default=Notification.NotificationType.ANNOUNCEMENT,
    )
    event_code = serializers.CharField(required=False, allow_blank=True, default="")
    channel = serializers.ChoiceField(
        choices=Notification.Channel.choices,
        default=Notification.Channel.IN_APP,
    )
    channels = serializers.ListField(
        child=serializers.ChoiceField(choices=Notification.Channel.choices),
        required=False,
        allow_empty=True,
        default=list,
    )
    priority = serializers.ChoiceField(
        choices=Notification.Priority.choices,
        default=Notification.Priority.MEDIUM,
    )
    action_url = serializers.CharField(required=False, allow_blank=True, default="")
    metadata = serializers.JSONField(required=False, default=dict)
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    role = serializers.ChoiceField(
        choices=["ADMIN", "TEACHER", "STUDENT", "ALL"],
        required=False,
        allow_null=True,
        default=None,
    )
    batch_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    force = serializers.BooleanField(default=False)
    send_email = serializers.BooleanField(required=False, default=None, allow_null=True)

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        user_ids = attrs.get("user_ids") or []
        role = attrs.get("role")
        batch_ids = attrs.get("batch_ids") or []
        if not user_ids and not role and not batch_ids:
            raise serializers.ValidationError(
                "Provide user_ids, role, and/or batch_ids for targeting."
            )

        # Teachers may not broadcast to ALL / ADMIN
        if user and getattr(user, "role", None) == "TEACHER":
            if role in ("ALL", "ADMIN", "TEACHER"):
                raise serializers.ValidationError(
                    "Teachers may only notify assigned students or batches."
                )
            attrs["role"] = None if role == "STUDENT" else role
        return attrs

    def resolve_recipients(self):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        qs = User.objects.filter(is_active=True)
        user_ids = self.validated_data.get("user_ids") or []
        role = self.validated_data.get("role")
        batch_ids = self.validated_data.get("batch_ids") or []

        if actor and getattr(actor, "role", None) == "TEACHER":
            allowed = self._teacher_allowed_user_ids(actor)
            if user_ids:
                user_ids = [uid for uid in user_ids if uid in allowed]
            if batch_ids:
                batch_user_ids = self._batch_user_ids(batch_ids)
                user_ids = list(set(user_ids) | (batch_user_ids & allowed))
                batch_ids = []
            elif not user_ids:
                user_ids = list(allowed)
            qs = qs.filter(pk__in=user_ids, role="STUDENT")
            return qs.distinct()

        if user_ids:
            qs = qs.filter(pk__in=user_ids)
        if role and role != "ALL":
            qs = qs.filter(role=role)
        if batch_ids:
            batch_user_ids = self._batch_user_ids(batch_ids)
            if user_ids or (role and role != "ALL"):
                qs = qs.filter(pk__in=batch_user_ids)
            else:
                qs = User.objects.filter(is_active=True, pk__in=batch_user_ids)
        return qs.distinct()

    @staticmethod
    def _batch_user_ids(batch_ids: list[int]) -> set[int]:
        try:
            from apps.batches.models import BatchStudent

            return set(
                BatchStudent.objects.filter(batch_id__in=batch_ids).values_list(
                    "student__user_id", flat=True
                )
            )
        except Exception:
            return set()

    @staticmethod
    def _teacher_allowed_user_ids(teacher_user) -> set[int]:
        allowed: set[int] = set()
        try:
            from apps.teachers.models import Teacher
            from apps.batches.models import Batch, BatchStudent

            teacher = Teacher.objects.filter(user=teacher_user).first()
            if not teacher:
                return allowed
            batch_ids = Batch.objects.filter(teacher=teacher).values_list("id", flat=True)
            allowed |= set(
                BatchStudent.objects.filter(batch_id__in=batch_ids).values_list(
                    "student__user_id", flat=True
                )
            )
        except Exception:
            pass
        return {uid for uid in allowed if uid}


class BroadcastNotificationSerializer(CreateNotificationSerializer):
    """Admin broadcast / targeted notification creation (legacy alias)."""

    related_object_type = serializers.CharField(required=False, allow_blank=True, default="")
    related_object_id = serializers.CharField(required=False, allow_blank=True, default="")

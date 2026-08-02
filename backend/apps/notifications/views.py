"""DRF viewsets for notifications."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import created_response, error_response, success_response
from apps.notifications.models import Notification, NotificationPreference, NotificationTemplate
from apps.notifications.permissions import (
    CanSendManualNotification,
    IsAdminForAnalytics,
    IsAdminForBroadcast,
    IsNotificationOwnerOrAdmin,
)
from apps.notifications.serializers import (
    BroadcastNotificationSerializer,
    CreateNotificationSerializer,
    NotificationPreferenceSerializer,
    NotificationSerializer,
    NotificationTemplateSerializer,
)
from apps.notifications.services import (
    NotificationAnalyticsService,
    NotificationService,
    get_or_create_preferences,
    mark_all_read,
    notify_users,
)


class NotificationSendThrottle(UserRateThrottle):
    scope = "notification_send"


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    List / retrieve / delete own notifications.

    Actions:
    - POST /{id}/mark_read/
    - POST /{id}/archive/
    - POST /mark_all_read/
    - POST /create/ | /send/ | /broadcast/
    - GET /unread_count/
    - GET /analytics/
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, IsNotificationOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        "notification_type",
        "channel",
        "priority",
        "status",
        "is_read",
        "is_archived",
        "event_code",
    ]
    search_fields = ["title", "message", "event_code"]
    ordering_fields = ["created_at", "priority", "is_read", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Notification.objects.select_related("recipient")
        if getattr(self, "swagger_fake_view", False):
            return qs.none()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        include_archived = self.request.query_params.get("include_archived") in (
            "1",
            "true",
            "True",
        )
        if not include_archived and self.action in ("list", "unread_count"):
            qs = qs.filter(is_archived=False)
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF) and self.request.query_params.get(
            "all"
        ) in ("1", "true", "True"):
            return qs
        return qs.filter(recipient=user)

    def perform_destroy(self, instance):
        NotificationService.soft_delete(instance, user=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark_read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        NotificationService.mark_read(notification, user=request.user)
        return success_response(
            data=NotificationSerializer(notification).data,
            message="Notification marked as read.",
        )

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        notification = self.get_object()
        NotificationService.archive(notification, user=request.user)
        return success_response(
            data=NotificationSerializer(notification).data,
            message="Notification archived.",
        )

    @action(detail=False, methods=["post"], url_path="mark_all_read")
    def mark_all_read_action(self, request):
        count = mark_all_read(request.user)
        return success_response(
            data={"marked": count},
            message=f"Marked {count} notification(s) as read.",
        )

    @action(detail=False, methods=["get"], url_path="unread_count")
    def unread_count(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False, is_archived=False
        ).count()
        return success_response(data={"unread_count": count})

    def _send(self, request, serializer_class):
        serializer = serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        recipients = serializer.resolve_recipients()
        if not recipients.exists():
            return error_response(
                message="No recipients matched the targeting criteria.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        data = serializer.validated_data
        created = notify_users(
            recipients,
            title=data["title"],
            message=data["message"],
            notification_type=data["notification_type"],
            event_code=data.get("event_code", ""),
            channel=data["channel"],
            channels=data.get("channels") or [],
            priority=data["priority"],
            action_url=data.get("action_url", ""),
            metadata=data.get("metadata") or {},
            related_object_type=data.get("related_object_type", ""),
            related_object_id=data.get("related_object_id", ""),
            force=data.get("force", False),
            send_email=data.get("send_email"),
            actor=request.user,
        )
        return created_response(
            data={
                "created_count": len(created),
                "recipient_count": recipients.count(),
            },
            message="Notification sent.",
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="broadcast",
        permission_classes=[IsAuthenticated, IsAdminForBroadcast],
        serializer_class=BroadcastNotificationSerializer,
        throttle_classes=[NotificationSendThrottle],
    )
    def broadcast(self, request):
        return self._send(request, BroadcastNotificationSerializer)

    @action(
        detail=False,
        methods=["post"],
        url_path="send",
        permission_classes=[IsAuthenticated, CanSendManualNotification],
        serializer_class=CreateNotificationSerializer,
        throttle_classes=[NotificationSendThrottle],
    )
    def send(self, request):
        return self._send(request, CreateNotificationSerializer)

    @action(
        detail=False,
        methods=["post"],
        url_path="create",
        permission_classes=[IsAuthenticated, CanSendManualNotification],
        serializer_class=CreateNotificationSerializer,
        throttle_classes=[NotificationSendThrottle],
    )
    def create_notification(self, request):
        return self._send(request, CreateNotificationSerializer)

    @action(
        detail=False,
        methods=["get"],
        url_path="analytics",
        permission_classes=[IsAuthenticated, IsAdminForAnalytics],
    )
    def analytics(self, request):
        try:
            days = int(request.query_params.get("days", 30))
        except (TypeError, ValueError):
            days = 30
        data = NotificationAnalyticsService.overview(days=days)
        return success_response(data=data)


class NotificationPreferenceViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated, IsNotificationOwnerOrAdmin]
    http_method_names = ["get", "put", "patch", "head", "options"]

    def get_queryset(self):
        qs = NotificationPreference.objects.select_related("user")
        if getattr(self, "swagger_fake_view", False):
            return qs.none()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        get_or_create_preferences(user)
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF) and self.request.query_params.get(
            "all"
        ) in ("1", "true", "True"):
            return qs
        return qs.filter(user=user)

    @action(detail=False, methods=["get", "put", "patch"], url_path="me")
    def me(self, request):
        prefs = get_or_create_preferences(request.user)
        if request.method in ("PUT", "PATCH"):
            partial = request.method == "PATCH"
            serializer = self.get_serializer(prefs, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return success_response(
                data=serializer.data,
                message="Preferences updated.",
            )
        return success_response(data=self.get_serializer(prefs).data)


class NotificationTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminForBroadcast]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["code", "channel", "notification_type", "is_active"]
    search_fields = ["code", "name", "title_template"]
    ordering = ["code", "channel"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return NotificationTemplate.objects.all()

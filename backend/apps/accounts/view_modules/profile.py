"""Profile / settings / user admin API views."""

from rest_framework import generics, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter

from apps.accounts.activity import log_activity
from apps.accounts.models import ActivityLog, UserProfile, UserSettings
from apps.accounts.permissions import IsAdminRole
from apps.accounts.serializers import (
    ActivityLogSerializer,
    ChangePasswordSerializer,
    ProfileUpdateSerializer,
    UserProfileSerializer,
    UserSerializer,
    UserSettingsSerializer,
)
from apps.notifications.services import get_or_create_preferences
from django.contrib.auth import get_user_model

User = get_user_model()

class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        return profile

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ProfileUpdateSerializer
        return UserSerializer

    def retrieve(self, request, *args, **kwargs):
        UserProfile.objects.get_or_create(user=request.user)
        user = User.objects.select_related("profile").get(pk=request.user.pk)
        serializer = UserSerializer(user, context={"request": request})
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        # Multipart avatar upload → save under MEDIA_ROOT/avatars/
        avatar_file = request.FILES.get("avatar") or request.FILES.get("profile_image")
        if avatar_file:
            user = request.user
            user.avatar = avatar_file
            user.save(update_fields=["avatar"])
            log_activity(
                user,
                action="profile_updated",
                request=request,
                object_id=user.pk,
                object_repr=user.email,
                metadata={"avatar_uploaded": True},
            )
            user = User.objects.select_related("profile").get(pk=user.pk)
            return Response(UserSerializer(user, context={"request": request}).data)

        # Prefer flat dashboard payload; fall back to nested profile fields.
        if any(
            key in request.data
            for key in (
                "name",
                "email",
                "avatar_url",
                "title",
                "location",
                "first_name",
                "last_name",
                "phone",
                "bio",
            )
        ):
            serializer = ProfileUpdateSerializer(
                data=request.data,
                partial=kwargs.pop("partial", False),
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            log_activity(
                user,
                action="profile_updated",
                request=request,
                object_id=user.pk,
                object_repr=user.email,
            )
            return Response(UserSerializer(user, context={"request": request}).data)

        partial = kwargs.pop("partial", False)
        profile = self.get_object()
        profile_serializer = UserProfileSerializer(
            profile,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        profile_serializer.is_valid(raise_exception=True)
        profile_serializer.save()

        user_fields = {
            key: request.data[key]
            for key in ("first_name", "last_name", "phone", "username", "avatar", "avatar_url", "email")
            if key in request.data
        }
        if user_fields:
            if "email" in user_fields:
                email = str(user_fields["email"]).lower().strip()
                if User.objects.filter(email__iexact=email).exclude(pk=request.user.pk).exists():
                    return Response(
                        {"email": ["A user with this email already exists."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user_fields["email"] = email
            user_serializer = UserSerializer(
                request.user,
                data=user_fields,
                partial=True,
                context={"request": request},
            )
            user_serializer.is_valid(raise_exception=True)
            user_serializer.save()

        log_activity(
            request.user,
            action="profile_updated",
            request=request,
            object_id=request.user.pk,
            object_repr=request.user.email,
        )
        return Response(
            UserSerializer(request.user, context={"request": request}).data
        )


class SettingsView(generics.RetrieveUpdateAPIView):
    """GET/PATCH account + notification preference settings for the signed-in user."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSettingsSerializer

    def get_object(self):
        settings_obj, _ = UserSettings.objects.get_or_create(user=self.request.user)
        return settings_obj

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return Response(self.get_serializer(instance).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_activity(
            request.user,
            action="settings_updated",
            request=request,
            object_id=request.user.pk,
            object_repr=request.user.email,
        )
        return Response(serializer.data)


class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["put", "patch"]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_activity(
            request.user,
            action="password_changed",
            request=request,
            object_id=request.user.pk,
            object_repr=request.user.email,
        )
        try:
            from apps.notifications.services import notify_password_changed

            notify_password_changed(request.user)
        except Exception:
            pass
        return Response(
            {"detail": "Password updated successfully."},
            status=status.HTTP_200_OK,
        )


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile").all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["role", "is_active", "is_active_account", "is_email_verified"]
    search_fields = ["email", "first_name", "last_name", "phone", "username"]
    ordering_fields = ["created_at", "email", "role", "last_login"]
    ordering = ["-created_at"]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.is_active_account = False
        instance.save(update_fields=["is_active", "is_active_account", "updated_at"])


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.select_related("user").all()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["action", "module", "user"]
    search_fields = ["action", "module", "object_repr", "user__email"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]


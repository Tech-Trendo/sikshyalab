from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import IsAdminRole
from apps.roles.models import FeatureFlag, Permission, Role, UserRole
from apps.roles.serializers import (
    FeatureFlagSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserRoleSerializer,
)


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["module"]
    search_fields = ["codename", "name", "module", "description"]
    ordering_fields = ["module", "codename", "name", "created_at"]
    ordering = ["module", "codename"]


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.prefetch_related("permissions").all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "is_system"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"detail": "System roles cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="assign-permissions")
    def assign_permissions(self, request, pk=None):
        role = self.get_object()
        permission_ids = request.data.get("permission_ids", [])
        if not isinstance(permission_ids, list):
            return Response(
                {"detail": "permission_ids must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        permissions = Permission.objects.filter(id__in=permission_ids)
        role.permissions.set(permissions)
        serializer = self.get_serializer(role)
        return Response(serializer.data)


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.select_related("user", "role", "assigned_by").all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["user", "role"]
    search_fields = ["user__email", "role__name"]
    ordering_fields = ["assigned_at"]
    ordering = ["-assigned_at"]

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)


class FeatureFlagViewSet(viewsets.ModelViewSet):
    queryset = FeatureFlag.objects.prefetch_related("roles").all()
    serializer_class = FeatureFlagSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_enabled"]
    search_fields = ["name", "codename", "description"]
    ordering_fields = ["name", "codename", "created_at"]
    ordering = ["name"]

    @action(detail=True, methods=["post"], url_path="toggle")
    def toggle(self, request, pk=None):
        flag = self.get_object()
        flag.is_enabled = not flag.is_enabled
        flag.save(update_fields=["is_enabled", "updated_at"])
        return Response(self.get_serializer(flag).data)

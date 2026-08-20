from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from apps.accounts.permissions import IsAdminRole
from apps.common.responses import error_response, success_response
from apps.roles.matrix import (
    apply_permission_matrix,
    build_effective_permission_matrix,
    build_permission_matrix,
    coerce_bool_or_null,
    CRUD_FIELDS,
    extract_modules_payload,
    resolve_matrix_role,
)
from apps.roles.models import FeatureFlag, Permission, Role, UserPermissionOverride, UserRole
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

    @action(detail=True, methods=["get", "put"], url_path="permissions")
    def role_permissions(self, request, pk=None):
        """
        GET /roles/{id}/permissions/ — CRUD permission matrix for the role.
        PUT /roles/{id}/permissions/ — replace permissions by id list.
        """
        role = self.get_object()
        if request.method == "GET":
            return success_response(
                data=build_permission_matrix(role),
                message="Role permission matrix.",
            )
        permission_ids = request.data.get("permission_ids", [])
        if not isinstance(permission_ids, list):
            return error_response(
                message="permission_ids must be a list.",
                errors={"permission_ids": ["Must be a list of permission ids."]},
            )
        permissions = Permission.objects.filter(id__in=permission_ids)
        role.permissions.set(permissions)
        return success_response(
            data=build_permission_matrix(role),
            message="Role permissions updated.",
        )


class RolePermissionMatrixView(APIView):
    """
    GET/PATCH /api/v1/roles/<role>/permissions/

    ``role`` is ``Teacher`` or ``Student`` (case-insensitive). Admin only.
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def _role_or_404(self, role_slug: str):
        role = resolve_matrix_role(role_slug)
        if role is None:
            return None, error_response(
                message="Role not found. Use Teacher or Student.",
                errors={"detail": "Role not found. Use Teacher or Student."},
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return role, None

    def get(self, request, role: str):
        obj, error = self._role_or_404(role)
        if error:
            return error
        return success_response(
            data=build_permission_matrix(obj),
            message="Role permission matrix.",
        )

    def patch(self, request, role: str):
        obj, error = self._role_or_404(role)
        if error:
            return error
        modules = request.data.get("modules")
        if not isinstance(modules, list):
            return error_response(
                message="modules must be a list of {module, can_view, can_create, can_edit, can_delete}.",
                errors={"modules": ["Must be a list."]},
            )
        return success_response(
            data=apply_permission_matrix(obj, modules),
            message="Role permissions updated.",
        )

    def put(self, request, role: str):
        return self.patch(request, role)


class UserPermissionOverrideMatrixView(APIView):
    """
    GET/PATCH /api/v1/users/<user_id>/permissions/

    Admin-only: view/edit per-user overrides.

    Overrides are applied on top of role-level defaults:
      - override field != null: use override boolean
      - override field == null: inherit role default
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def _user_or_404(self, user_id: int):
        User = get_user_model()
        try:
            return User.objects.get(pk=user_id), None
        except User.DoesNotExist:
            return None, error_response(
                message="User not found.",
                errors={"user_id": ["User not found."]},
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, user_id: int):
        obj, error = self._user_or_404(user_id)
        if error:
            return error
        return success_response(
            data=build_effective_permission_matrix(obj),
            message="User permission matrix.",
        )

    def patch(self, request, user_id: int):
        obj, error = self._user_or_404(user_id)
        if error:
            return error

        modules = extract_modules_payload(request.data)
        if not isinstance(modules, list):
            return error_response(
                message="modules must be a list of {module, can_view, can_create, can_edit, can_delete}.",
                errors={"modules": ["Must be a list."]},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        for row in modules:
            module = str((row or {}).get("module") or "").strip()
            if not module:
                continue

            # Only create an override row if at least one provided permission is non-null.
            provided_any = any(k in row for k in CRUD_FIELDS)
            if not provided_any:
                continue

            # Fetch existing override (if any).
            override = UserPermissionOverride.objects.filter(user=obj, module=module).first()

            # Determine if we should create (when nothing exists yet).
            if override is None:
                any_non_null = any(
                    (k in row and row.get(k) is not None)
                    for k in CRUD_FIELDS
                )
                if not any_non_null:
                    # User wants no override (all provided values are null) → noop.
                    continue
                override = UserPermissionOverride(user=obj, module=module)

            # Apply provided fields (missing fields are ignored).
            try:
                for field in CRUD_FIELDS:
                    if field in row:
                        setattr(override, field, coerce_bool_or_null(row.get(field)))
            except ValueError:
                return error_response(
                    message="Invalid boolean value in module override.",
                    errors={"modules": [f"Invalid values for module={module}."]},
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            # If all override fields are null, remove the override row.
            if (
                override.can_view is None
                and override.can_create is None
                and override.can_edit is None
                and override.can_delete is None
            ):
                override.delete()
            else:
                override.save()

        return success_response(
            data=build_effective_permission_matrix(obj),
            message="User permissions updated.",
        )


class UserPermissionMeView(APIView):
    """
    GET /api/v1/users/me/permissions/

    Self-service: any authenticated user reads their own effective matrix.
    Resolution order matches the admin user endpoint (override → role default).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(
            data=build_effective_permission_matrix(request.user),
            message="Your permission matrix.",
        )


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

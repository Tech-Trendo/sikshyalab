from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.roles.models import FeatureFlag, Permission, Role, UserRole

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            "id",
            "codename",
            "name",
            "module",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        source="permissions",
        write_only=True,
        required=False,
    )
    permission_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "description",
            "permissions",
            "permission_ids",
            "permission_count",
            "is_system",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "permissions", "permission_count"]

    def get_permission_count(self, obj):
        return obj.permissions.count()


class UserRoleSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    assigned_by_email = serializers.EmailField(
        source="assigned_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = UserRole
        fields = [
            "id",
            "user",
            "user_email",
            "role",
            "role_name",
            "assigned_by",
            "assigned_by_email",
            "assigned_at",
        ]
        read_only_fields = [
            "id",
            "assigned_by",
            "assigned_at",
            "user_email",
            "role_name",
            "assigned_by_email",
        ]

    def validate(self, attrs):
        user = attrs.get("user") or getattr(self.instance, "user", None)
        role = attrs.get("role") or getattr(self.instance, "role", None)
        if user and role:
            qs = UserRole.objects.filter(user=user, role=role)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "This user already has the selected role."
                )
        return attrs


class FeatureFlagSerializer(serializers.ModelSerializer):
    roles = RoleSerializer(many=True, read_only=True)
    role_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Role.objects.all(),
        source="roles",
        write_only=True,
        required=False,
    )

    class Meta:
        model = FeatureFlag
        fields = [
            "id",
            "name",
            "codename",
            "is_enabled",
            "roles",
            "role_ids",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "roles"]

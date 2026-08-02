from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.roles.views import (
    FeatureFlagViewSet,
    PermissionViewSet,
    RoleViewSet,
    UserRoleViewSet,
)

app_name = "roles"

router = DefaultRouter()
router.register(r"permissions", PermissionViewSet, basename="permission")
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"user-roles", UserRoleViewSet, basename="user-role")
router.register(r"feature-flags", FeatureFlagViewSet, basename="feature-flag")

urlpatterns = [
    path("", include(router.urls)),
]

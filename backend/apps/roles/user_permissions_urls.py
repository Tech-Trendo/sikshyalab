from django.urls import path

from apps.roles.views import UserPermissionMeView, UserPermissionOverrideMatrixView


urlpatterns = [
    path(
        "me/permissions/",
        UserPermissionMeView.as_view(),
        name="user-permission-me",
    ),
    path(
        "<int:user_id>/permissions/",
        UserPermissionOverrideMatrixView.as_view(),
        name="user-permission-overrides",
    ),
]


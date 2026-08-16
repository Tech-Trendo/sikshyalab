"""
API v1 URL router.

App-specific routers are included here as they are implemented.
"""

from django.urls import include, path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # JWT auth
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # App routers (uncomment as urls modules are added)
    path("accounts/", include("apps.accounts.urls")),
    path("roles/", include("apps.roles.urls")),
    path("students/", include("apps.students.urls")),
    path("teachers/", include("apps.teachers.urls")),
    path("courses/", include("apps.courses.urls")),
    path("content/", include("apps.content.urls")),
    path("batches/", include("apps.batches.urls")),
    path("enrollments/", include("apps.enrollments.urls")),
    path("fees/", include("apps.fees.urls")),
    path("assignments/", include("apps.assignments.urls")),
    path("certificates/", include("apps.certificates.urls")),
    path("cms/", include("apps.cms.urls")),
    path("seo/", include("apps.seo.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("analytics/", include("apps.analytics.urls")),
    path("tasks/", include("apps.tasks.urls")),
    path("", include("apps.videos.urls")),
    path("exports/", include("apps.common.urls")),
]

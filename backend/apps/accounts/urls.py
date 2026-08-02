from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import (
    ActivityLogViewSet,
    AdminCreateUserView,
    ChangePasswordView,
    ConsumeLoginHandoffView,
    CreateLoginHandoffView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    ProfileView,
    RegisterView,
    ResendPasswordResetOTPView,
    ResetPasswordView,
    ResetTokenStatusView,
    SettingsView,
    UserViewSet,
    VerifyPasswordResetOTPView,
)

app_name = "accounts"

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"activity-logs", ActivityLogViewSet, basename="activity-log")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/register", RegisterView.as_view()),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/login", LoginView.as_view()),
    path("auth/handoff/", CreateLoginHandoffView.as_view(), name="create-handoff"),
    path("auth/handoff", CreateLoginHandoffView.as_view()),
    path("auth/handoff/consume/", ConsumeLoginHandoffView.as_view(), name="consume-handoff"),
    path("auth/handoff/consume", ConsumeLoginHandoffView.as_view()),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/logout", LogoutView.as_view()),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/token/refresh", TokenRefreshView.as_view()),
    path("auth/profile/", ProfileView.as_view(), name="profile"),
    path("auth/profile", ProfileView.as_view()),
    path("auth/settings/", SettingsView.as_view(), name="settings"),
    path("auth/settings", SettingsView.as_view()),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("auth/change-password", ChangePasswordView.as_view()),
    path("auth/forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("auth/forgot-password", ForgotPasswordView.as_view()),
    path("auth/verify-otp/", VerifyPasswordResetOTPView.as_view(), name="verify-otp"),
    path("auth/verify-otp", VerifyPasswordResetOTPView.as_view()),
    path("auth/resend-otp/", ResendPasswordResetOTPView.as_view(), name="resend-otp"),
    path("auth/resend-otp", ResendPasswordResetOTPView.as_view()),
    path("auth/reset-token-status/", ResetTokenStatusView.as_view(), name="reset-token-status"),
    path("auth/reset-token-status", ResetTokenStatusView.as_view()),
    path("auth/reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("auth/reset-password", ResetPasswordView.as_view()),
    path("admin/create-user/", AdminCreateUserView.as_view(), name="admin-create-user"),
    path("admin/create-user", AdminCreateUserView.as_view()),
    path("", include(router.urls)),
]

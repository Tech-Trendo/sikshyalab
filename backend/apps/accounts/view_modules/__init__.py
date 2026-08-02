"""Accounts view modules — re-exported via apps.accounts.views."""

from apps.accounts.view_modules.auth import (
    AdminCreateUserView,
    ConsumeLoginHandoffView,
    CreateLoginHandoffView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    RegisterView,
    ResendPasswordResetOTPView,
    ResetPasswordView,
    ResetTokenStatusView,
    VerifyPasswordResetOTPView,
)
from apps.accounts.view_modules.profile import (
    ActivityLogViewSet,
    ChangePasswordView,
    ProfileView,
    SettingsView,
    UserViewSet,
)

__all__ = [
    "ActivityLogViewSet",
    "AdminCreateUserView",
    "ChangePasswordView",
    "ConsumeLoginHandoffView",
    "CreateLoginHandoffView",
    "ForgotPasswordView",
    "LoginView",
    "LogoutView",
    "ProfileView",
    "RegisterView",
    "ResendPasswordResetOTPView",
    "ResetPasswordView",
    "ResetTokenStatusView",
    "SettingsView",
    "UserViewSet",
    "VerifyPasswordResetOTPView",
]

"""Accounts API views (facade — implementations in view_modules/)."""

from apps.accounts.view_modules import (
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

"""Auth / handoff / password-reset API views."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from apps.accounts.activity import get_client_ip, log_activity
from apps.accounts.models import UserProfile, UserSettings
from apps.accounts.password_reset import (
    check_reset_token,
    complete_password_reset,
    request_password_reset,
    resend_otp,
    verify_otp,
)
from apps.accounts.permissions import IsAdminRole
from apps.accounts.provisioning import provision_user
from apps.accounts.serializers import (
    AdminCreateUserSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    ResendOTPSerializer,
    ResetPasswordSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)
from apps.notifications.services import ensure_inbox_seeded, get_or_create_preferences

User = get_user_model()

class RegisterView(APIView):
    """Public self-registration is disabled. Admins provision accounts."""

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Public registration is disabled. "
                    "Ask an administrator to create your account."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )


class AdminCreateUserView(APIView):
    """Admin-only: create Teacher/Student/Admin with temporary password + email."""

    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, *args, **kwargs):
        serializer = AdminCreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user, temporary_password, email_sent, email_error, enrollment = provision_user(
                email=data["email"],
                role=data["role"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                phone=data.get("phone"),
                create_role_profile=data.get("create_profile", True),
                send_email=data.get("send_email", True),
                course=data.get("course_obj"),
                batch=data.get("batch_obj"),
                changed_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        student = getattr(user, "student_profile", None)
        if student is None and user.role == user.Role.STUDENT:
            from apps.students.models import Student

            student = Student.objects.filter(user=user).first()

        log_activity(
            request.user,
            action="user_provisioned",
            request=request,
            object_id=user.pk,
            object_repr=user.email,
            metadata={
                "role": user.role,
                "email_sent": email_sent,
                "email_error": email_error or None,
                "enrollment_id": str(enrollment.pk) if enrollment else None,
            },
        )

        payload = {
            "id": user.pk,
            "email": user.email,
            "name": user.get_full_name(),
            "phone": user.phone or "",
            "role": user.role,
            "student_id": getattr(student, "student_id", None),
            "course": str(enrollment.course_id) if enrollment else None,
            "batch": str(enrollment.batch_id) if enrollment and enrollment.batch_id else None,
            "enrollment_id": str(enrollment.pk) if enrollment else None,
            "temporary_password": temporary_password,
            "email_sent": email_sent,
            "email_error": email_error or None,
            "must_change_password": user.must_change_password,
        }
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=["last_login", "last_login_ip"])

        UserProfile.objects.get_or_create(user=user)
        UserSettings.objects.get_or_create(user=user)
        get_or_create_preferences(user)
        ensure_inbox_seeded(user)

        log_activity(
            user,
            action="user_login",
            request=request,
            object_id=user.pk,
            object_repr=user.email,
        )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user, context={"request": request}).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
                "must_change_password": bool(user.must_change_password),
            },
            status=status.HTTP_200_OK,
        )


class CreateLoginHandoffView(APIView):
    """
    Exchange current JWTs for a short one-time code.

    Used when the public site (e.g. :8081) redirects to the dashboard (:5173)
    so we don't put long JWTs in the URL hash (often truncated / lost).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        access = (request.data.get("access") or "").strip()
        refresh = (request.data.get("refresh") or "").strip()
        if not access or not refresh:
            return Response(
                {"detail": "access and refresh tokens are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        code = secrets.token_urlsafe(24)
        cache.set(
            f"login_handoff:{code}",
            {
                "access": access,
                "refresh": refresh,
                "email": request.user.email,
                "role": request.user.role,
                "name": request.user.get_full_name() or request.user.email,
                "must_change_password": bool(request.user.must_change_password),
            },
            timeout=120,
        )
        return Response({"code": code}, status=status.HTTP_201_CREATED)


class ConsumeLoginHandoffView(APIView):
    """One-time consume of a login handoff code → JWT pair + user metadata."""

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        code = (request.data.get("code") or "").strip()
        if not code:
            return Response({"detail": "code is required."}, status=status.HTTP_400_BAD_REQUEST)
        key = f"login_handoff:{code}"
        payload = cache.get(key)
        if not payload:
            return Response(
                {"detail": "Invalid or expired handoff code. Please sign in again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cache.delete(key)
        return Response(payload, status=status.HTTP_200_OK)


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"


class PasswordResetOTPThrottle(AnonRateThrottle):
    scope = "password_reset_otp"


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request, *args, **kwargs):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = request_password_reset(
                identifier=serializer.validated_data["identifier"],
                request=request,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload, status=status.HTTP_200_OK)


class VerifyPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetOTPThrottle]

    def post(self, request, *args, **kwargs):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = verify_otp(
            request_id=str(serializer.validated_data["request_id"]),
            otp=serializer.validated_data["otp"],
            request=request,
        )
        if not result.get("ok"):
            return Response(
                {"detail": result.get("detail")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "detail": result["detail"],
                "reset_token": result["reset_token"],
                "expires_in_seconds": result["expires_in_seconds"],
            },
            status=status.HTTP_200_OK,
        )


class ResendPasswordResetOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request, *args, **kwargs):
        serializer = ResendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = resend_otp(
            request_id=str(serializer.validated_data["request_id"]),
            request=request,
        )
        return Response(payload, status=status.HTTP_200_OK)


class ResetTokenStatusView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def get(self, request, *args, **kwargs):
        token = (request.query_params.get("token") or "").strip()
        if not token:
            return Response(
                {"valid": False, "detail": "token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(check_reset_token(token), status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request, *args, **kwargs):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = complete_password_reset(
            token=serializer.validated_data["token"],
            new_password=serializer.validated_data["new_password"],
            request=request,
        )
        if not result.get("ok"):
            return Response(
                {"detail": result.get("detail")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"detail": result["detail"]}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except AttributeError:
            # Blacklist app not installed — still accept logout.
            pass
        except TokenError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        log_activity(
            request.user,
            action="user_logout",
            request=request,
            object_id=request.user.pk,
            object_repr=request.user.email,
        )
        return Response(
            {"detail": "Successfully logged out."},
            status=status.HTTP_205_RESET_CONTENT,
        )


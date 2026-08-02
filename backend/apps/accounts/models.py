"""
ShikshaLab custom user model.

Email is the primary login identifier.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.mixins import SoftDeleteManager
from apps.common.models import SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class UserManager(BaseUserManager):
    """Custom manager where email is the unique identifier for auth."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_("The email address must be set."))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.STUDENT)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("is_active_account", True)
        extra_fields.setdefault("is_email_verified", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))

        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom user model using email as the primary login identifier."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", _("Admin")
        TEACHER = "TEACHER", _("Teacher")
        STUDENT = "STUDENT", _("Student")

    username = models.CharField(
        _("username"),
        max_length=150,
        unique=True,
        null=True,
        blank=True,
        help_text=_("Optional. 150 characters or fewer."),
    )
    email = models.EmailField(_("email address"), unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        db_index=True,
    )
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    avatar_url = models.URLField(
        max_length=500,
        blank=True,
        help_text=_("Optional remote avatar URL when no uploaded file is set."),
    )
    is_email_verified = models.BooleanField(default=False)
    is_active_account = models.BooleanField(
        default=True,
        help_text=_("Designates whether this account is active in ShikshaLab."),
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text=_("When true, user must set a new password before using the app."),
    )
    provisional_password = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text=_(
            "Last issued temporary password (admin-visible until the user changes it)."
        ),
    )
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("user")
        verbose_name_plural = _("users")
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
            models.Index(fields=["is_active_account"]),
        ]

    def __str__(self):
        return self.email

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.email


class UserProfile(models.Model):
    class Gender(models.TextChoices):
        MALE = "MALE", _("Male")
        FEMALE = "FEMALE", _("Female")
        OTHER = "OTHER", _("Other")
        PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY", _("Prefer not to say")

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    title = models.CharField(
        max_length=120,
        blank=True,
        help_text=_("Headline shown on the profile card."),
    )
    bio = models.TextField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        blank=True,
    )
    profile_image = models.ImageField(
        upload_to="profile_images/",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__email"]
        verbose_name = _("user profile")
        verbose_name_plural = _("user profiles")

    def __str__(self):
        return f"Profile: {self.user.email}"

    @property
    def location(self) -> str:
        parts = [p for p in (self.city, self.state, self.country) if p]
        return ", ".join(parts)


class UserSettings(models.Model):
    """UI / account preferences (notification channels live on NotificationPreference)."""

    class Language(models.TextChoices):
        EN = "en", _("English")
        NE = "ne", _("Nepali")

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="settings",
    )
    language = models.CharField(
        max_length=8,
        choices=Language.choices,
        default=Language.EN,
    )
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    compact_sidebar = models.BooleanField(default=False)
    marketing_emails = models.BooleanField(default=False)
    digest_weekly = models.BooleanField(default=True)
    assignment_alerts = models.BooleanField(default=True)
    fee_reminders = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("user settings")
        verbose_name_plural = _("user settings")

    def __str__(self):
        return f"Settings: {self.user.email}"


class ActivityLog(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
    )
    action = models.CharField(max_length=100, db_index=True)
    module = models.CharField(max_length=100, blank=True, db_index=True)
    object_id = models.CharField(max_length=64, blank=True)
    object_repr = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("activity log")
        verbose_name_plural = _("activity logs")
        indexes = [
            models.Index(fields=["action", "module"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        user_label = self.user.email if self.user else "anonymous"
        return f"{user_label} — {self.action} ({self.module})"


class PasswordResetToken(models.Model):
    """One-time token issued after OTP verification (or legacy email link)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    reset_request = models.ForeignKey(
        "accounts.PasswordResetRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reset_tokens",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("password reset token")
        verbose_name_plural = _("password reset tokens")

    def __str__(self):
        return f"Reset token for {self.user.email}"

    @property
    def is_valid(self) -> bool:
        from django.utils import timezone

        return self.used_at is None and self.expires_at > timezone.now()


class PasswordResetRequest(UUIDPrimaryKeyModel, TimeStampedModel, SoftDeleteModel):
    """Forgot-password request started with email or phone (anti-enumeration)."""

    class Channel(models.TextChoices):
        EMAIL = "EMAIL", _("Email")
        SMS = "SMS", _("SMS")

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        OTP_SENT = "OTP_SENT", _("OTP Sent")
        VERIFIED = "VERIFIED", _("Verified")
        COMPLETED = "COMPLETED", _("Completed")
        EXPIRED = "EXPIRED", _("Expired")
        LOCKED = "LOCKED", _("Locked")
        FAILED = "FAILED", _("Failed")

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="password_reset_requests",
    )
    identifier = models.CharField(
        max_length=255,
        db_index=True,
        help_text=_("Email or phone as submitted (normalized)."),
    )
    channel = models.CharField(
        max_length=10,
        choices=Channel.choices,
        default=Channel.EMAIL,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    expires_at = models.DateTimeField()
    locked_until = models.DateTimeField(null=True, blank=True)
    failure_count = models.PositiveSmallIntegerField(default=0)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("password reset request")
        verbose_name_plural = _("password reset requests")
        indexes = [
            models.Index(fields=["identifier", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"Reset request {self.id} ({self.identifier})"


class OTPVerification(UUIDPrimaryKeyModel, TimeStampedModel):
    """Hashed one-time password for a password-reset request."""

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        VERIFIED = "VERIFIED", _("Verified")
        EXPIRED = "EXPIRED", _("Expired")
        LOCKED = "LOCKED", _("Locked")

    reset_request = models.ForeignKey(
        PasswordResetRequest,
        on_delete=models.CASCADE,
        related_name="otps",
    )
    otp_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField(db_index=True)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("OTP verification")
        verbose_name_plural = _("OTP verifications")
        indexes = [
            models.Index(fields=["reset_request", "status"]),
        ]

    def __str__(self):
        return f"OTP {self.id} ({self.status})"


class PasswordResetAudit(UUIDPrimaryKeyModel, TimeStampedModel):
    """Immutable audit trail for password-reset lifecycle events."""

    class Action(models.TextChoices):
        REQUESTED = "REQUESTED", _("Requested")
        OTP_SENT = "OTP_SENT", _("OTP Sent")
        OTP_RESENT = "OTP_RESENT", _("OTP Resent")
        OTP_FAILED = "OTP_FAILED", _("OTP Failed")
        OTP_VERIFIED = "OTP_VERIFIED", _("OTP Verified")
        LOCKED = "LOCKED", _("Locked")
        PASSWORD_RESET = "PASSWORD_RESET", _("Password Reset")
        TOKEN_ISSUED = "TOKEN_ISSUED", _("Token Issued")

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="password_reset_audits",
    )
    reset_request = models.ForeignKey(
        PasswordResetRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audits",
    )
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    detail = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("password reset audit")
        verbose_name_plural = _("password reset audits")

    def __str__(self):
        return f"{self.action} @ {self.created_at}"

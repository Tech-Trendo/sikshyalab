from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.accounts.models import ActivityLog, UserProfile, UserSettings

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    location = serializers.CharField(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "title",
            "bio",
            "address",
            "city",
            "state",
            "country",
            "location",
            "postal_code",
            "date_of_birth",
            "gender",
            "profile_image",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "location", "created_at", "updated_at"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    avatar_display = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "phone",
            "avatar",
            "avatar_url",
            "avatar_display",
            "title",
            "bio",
            "location",
            "is_email_verified",
            "is_active_account",
            "must_change_password",
            "is_active",
            "is_staff",
            "last_login",
            "last_login_ip",
            "date_joined",
            "created_at",
            "updated_at",
            "profile",
        ]
        read_only_fields = [
            "id",
            "is_email_verified",
            "must_change_password",
            "last_login",
            "last_login_ip",
            "date_joined",
            "created_at",
            "updated_at",
            "is_staff",
            "profile",
            "full_name",
            "avatar_display",
            "title",
            "bio",
            "location",
        ]

    def get_avatar_display(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            url = obj.avatar.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return obj.avatar_url or ""

    def get_title(self, obj):
        profile = getattr(obj, "profile", None)
        return getattr(profile, "title", "") if profile else ""

    def get_bio(self, obj):
        profile = getattr(obj, "profile", None)
        return getattr(profile, "bio", "") if profile else ""

    def get_location(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.location if profile else ""


class ProfileUpdateSerializer(serializers.Serializer):
    """Flat payload used by the dashboard profile page."""

    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=150)
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    title = serializers.CharField(required=False, allow_blank=True, max_length=120)
    bio = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True, max_length=255)
    city = serializers.CharField(required=False, allow_blank=True, max_length=100)
    state = serializers.CharField(required=False, allow_blank=True, max_length=100)
    country = serializers.CharField(required=False, allow_blank=True, max_length=100)
    address = serializers.CharField(required=False, allow_blank=True)
    postal_code = serializers.CharField(required=False, allow_blank=True, max_length=20)
    gender = serializers.ChoiceField(
        choices=UserProfile.Gender.choices,
        required=False,
        allow_blank=True,
    )
    date_of_birth = serializers.DateField(required=False, allow_null=True)

    def validate_email(self, value):
        email = value.lower().strip()
        user = self.context["request"].user
        if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_phone(self, value):
        if value in (None, ""):
            return None
        user = self.context["request"].user
        if User.objects.filter(phone=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("A user with this phone already exists.")
        return value

    def _split_name(self, name: str):
        parts = name.strip().split(None, 1)
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], parts[1]

    def _parse_location(self, location: str) -> dict:
        parts = [p.strip() for p in location.split(",") if p.strip()]
        if not parts:
            return {}
        if len(parts) == 1:
            return {"city": parts[0]}
        if len(parts) == 2:
            return {"city": parts[0], "country": parts[1]}
        return {"city": parts[0], "state": parts[1], "country": parts[-1]}

    def save(self, **kwargs):
        user = self.context["request"].user
        data = self.validated_data
        profile, _ = UserProfile.objects.get_or_create(user=user)

        user_updates = []
        if "name" in data and data["name"].strip():
            first, last = self._split_name(data["name"])
            user.first_name = first
            user.last_name = last
            user_updates.extend(["first_name", "last_name"])
        if "first_name" in data:
            user.first_name = data["first_name"]
            user_updates.append("first_name")
        if "last_name" in data:
            user.last_name = data["last_name"]
            user_updates.append("last_name")
        if "email" in data:
            user.email = data["email"]
            user_updates.append("email")
        if "phone" in data:
            user.phone = data["phone"]
            user_updates.append("phone")
        if "username" in data:
            user.username = data["username"] or None
            user_updates.append("username")
        if "avatar_url" in data:
            user.avatar_url = data["avatar_url"]
            user_updates.append("avatar_url")

        if user_updates:
            user.save(update_fields=list(dict.fromkeys(user_updates + ["updated_at"])))

        profile_fields = [
            "title",
            "bio",
            "address",
            "city",
            "state",
            "country",
            "postal_code",
            "gender",
            "date_of_birth",
        ]
        profile_changed = False
        for field in profile_fields:
            if field in data:
                setattr(profile, field, data[field])
                profile_changed = True

        if "location" in data and data["location"].strip():
            for key, value in self._parse_location(data["location"]).items():
                setattr(profile, key, value)
            profile_changed = True

        if profile_changed:
            profile.save()

        return user


class UserSettingsSerializer(serializers.ModelSerializer):
    email_notifications = serializers.BooleanField(required=False)
    sms_notifications = serializers.BooleanField(required=False)
    in_app_notifications = serializers.BooleanField(required=False)

    class Meta:
        model = UserSettings
        fields = [
            "language",
            "timezone",
            "compact_sidebar",
            "marketing_emails",
            "digest_weekly",
            "assignment_alerts",
            "fee_reminders",
            "email_notifications",
            "sms_notifications",
            "in_app_notifications",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        prefs = getattr(instance.user, "notification_preferences", None)
        if prefs is None:
            from apps.notifications.services import get_or_create_preferences

            prefs = get_or_create_preferences(instance.user)
        data["email_notifications"] = prefs.email_enabled
        data["sms_notifications"] = prefs.sms_enabled
        data["in_app_notifications"] = prefs.in_app_enabled
        return data

    def update(self, instance, validated_data):
        email_notifications = validated_data.pop("email_notifications", None)
        sms_notifications = validated_data.pop("sms_notifications", None)
        in_app_notifications = validated_data.pop("in_app_notifications", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if any(v is not None for v in (email_notifications, sms_notifications, in_app_notifications)):
            from apps.notifications.services import get_or_create_preferences

            prefs = get_or_create_preferences(instance.user)
            if email_notifications is not None:
                prefs.email_enabled = email_notifications
            if sms_notifications is not None:
                prefs.sms_enabled = sms_notifications
            if in_app_notifications is not None:
                prefs.in_app_enabled = in_app_notifications

            type_prefs = dict(prefs.preferences or {})
            if instance.assignment_alerts is not None:
                type_prefs["ASSIGNMENT"] = {
                    **(type_prefs.get("ASSIGNMENT") or {}),
                    "in_app": instance.assignment_alerts,
                    "email": instance.assignment_alerts and prefs.email_enabled,
                }
            if instance.fee_reminders is not None:
                type_prefs["PAYMENT"] = {
                    **(type_prefs.get("PAYMENT") or {}),
                    "in_app": instance.fee_reminders,
                    "email": instance.fee_reminders and prefs.email_enabled,
                }
            prefs.preferences = type_prefs
            prefs.save()

        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "role",
            "password",
            "password_confirm",
        ]
        extra_kwargs = {
            "username": {"required": False, "allow_blank": True, "allow_null": True},
            "first_name": {"required": False},
            "last_name": {"required": False},
            "phone": {"required": False, "allow_blank": True, "allow_null": True},
            "role": {"required": False},
        }

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_role(self, value):
        # Public registration defaults to STUDENT; only allow TEACHER/STUDENT.
        if value not in (User.Role.STUDENT, User.Role.TEACHER):
            raise serializers.ValidationError(
                "Only STUDENT or TEACHER roles can be registered publicly."
            )
        return value

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("password_confirm"):
            raise serializers.ValidationError(
                {"password_confirm": "Password fields did not match."}
            )
        attrs.pop("password_confirm", None)
        attrs.setdefault("role", User.Role.STUDENT)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        username = validated_data.get("username") or None
        if username == "":
            username = None
        validated_data["username"] = username
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        trim_whitespace=False,
    )

    def validate(self, attrs):
        email = attrs.get("email", "").lower().strip()
        password = attrs.get("password")
        request = self.context.get("request")

        user = authenticate(request=request, username=email, password=password)
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active or not user.is_active_account:
            raise serializers.ValidationError("This account is inactive.")

        student_profile = None
        try:
            student_profile = user.student_profile
        except ObjectDoesNotExist:
            student_profile = None

        if student_profile is not None:
            from apps.students.models import Student

            if student_profile.status in Student.LOGIN_BLOCKED_STATUSES:
                # Heal legacy rows deactivated before login sync existed.
                if user.is_active or user.is_active_account:
                    user.is_active = False
                    user.is_active_account = False
                    user.save(update_fields=["is_active", "is_active_account", "updated_at"])
                raise serializers.ValidationError("This account is inactive.")

        attrs["user"] = user
        attrs["email"] = email
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        user = self.context["request"].user
        old_password = attrs.get("old_password") or ""
        # First-login forced change may omit old_password only when must_change_password
        if user.must_change_password:
            if old_password and not user.check_password(old_password):
                raise serializers.ValidationError({"old_password": "Current password is incorrect."})
        else:
            if not old_password:
                raise serializers.ValidationError({"old_password": "Current password is required."})
            if not user.check_password(old_password):
                raise serializers.ValidationError({"old_password": "Current password is incorrect."})

        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Password fields did not match."}
            )
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.provisional_password = ""
        user.save(
            update_fields=["password", "must_change_password", "provisional_password", "updated_at"]
        )
        return user


class AdminCreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    role = serializers.ChoiceField(choices=["ADMIN", "TEACHER", "STUDENT"])
    create_profile = serializers.BooleanField(default=True)
    send_email = serializers.BooleanField(default=True)
    course = serializers.UUIDField(required=False, allow_null=True)
    batch = serializers.UUIDField(required=False, allow_null=True)

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        name = (attrs.get("name") or "").strip()
        if name and not attrs.get("first_name"):
            parts = name.split(None, 1)
            attrs["first_name"] = parts[0]
            attrs["last_name"] = parts[1] if len(parts) > 1 else attrs.get("last_name", "")
        phone = attrs.get("phone")
        if phone in ("", None):
            attrs["phone"] = None
        else:
            email = attrs.get("email", "")
            qs = User.objects.filter(phone=phone)
            # Allow same phone when reusing the same email account
            if email:
                qs = qs.exclude(email__iexact=email)
            if qs.exists():
                raise serializers.ValidationError({"phone": "A user with this phone already exists."})

        course_id = attrs.get("course")
        batch_id = attrs.get("batch")
        role = (attrs.get("role") or "").upper()

        if (course_id or batch_id) and role != "STUDENT":
            raise serializers.ValidationError(
                {"course": "Course and batch can only be set when creating a student."}
            )

        course = None
        batch = None
        if course_id:
            from apps.courses.models import Course

            try:
                course = Course.objects.get(pk=course_id)
            except Course.DoesNotExist as exc:
                raise serializers.ValidationError({"course": "Course not found."}) from exc
            attrs["course_obj"] = course

        if batch_id:
            from apps.batches.models import Batch

            try:
                batch = Batch.objects.select_related("course", "shift").get(pk=batch_id)
            except Batch.DoesNotExist as exc:
                raise serializers.ValidationError({"batch": "Batch not found."}) from exc
            if course is None:
                course = batch.course
                attrs["course_obj"] = course
                attrs["course"] = course.pk
            elif batch.course_id != course.pk:
                raise serializers.ValidationError(
                    {"batch": "Batch does not belong to the selected course."}
                )
            attrs["batch_obj"] = batch

        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    """Accept email or phone via ``identifier`` (preferred) or legacy ``email``."""

    identifier = serializers.CharField(required=False, allow_blank=True, max_length=255)
    email = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        identifier = (attrs.get("identifier") or attrs.get("email") or "").strip()
        if not identifier:
            raise serializers.ValidationError(
                {"identifier": "Enter an email address or registered phone number."}
            )
        attrs["identifier"] = identifier
        return attrs


class VerifyOTPSerializer(serializers.Serializer):
    request_id = serializers.UUIDField()
    otp = serializers.CharField(min_length=6, max_length=6)


class ResendOTPSerializer(serializers.Serializer):
    request_id = serializers.UUIDField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Password fields did not match."}
            )
        return attrs


class ActivityLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "user",
            "user_email",
            "action",
            "module",
            "object_id",
            "object_repr",
            "ip_address",
            "user_agent",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields

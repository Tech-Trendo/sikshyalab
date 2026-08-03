"""
Serializers for the students app.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.students.models import (
    AcademicHistory,
    Guardian,
    Student,
    StudentActivityLog,
    StudentDocument,
)

User = get_user_model()


class StudentUserBriefSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    provisional_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "avatar",
            "provisional_password",
            "must_change_password",
        ]
        read_only_fields = fields

    def get_provisional_password(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            return ""
        from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role

        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return obj.provisional_password or ""
        return ""


class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = [
            "id",
            "student",
            "name",
            "relationship",
            "phone",
            "email",
            "occupation",
            "address",
            "is_primary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AcademicHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicHistory
        fields = [
            "id",
            "student",
            "institution",
            "degree_level",
            "field_of_study",
            "year_from",
            "year_to",
            "grade_gpa",
            "documents",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StudentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentDocument
        fields = [
            "id",
            "student",
            "doc_type",
            "title",
            "file",
            "issued_date",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StudentActivityLogSerializer(serializers.ModelSerializer):
    performed_by_email = serializers.EmailField(
        source="performed_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = StudentActivityLog
        fields = [
            "id",
            "student",
            "action",
            "description",
            "performed_by",
            "performed_by_email",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "performed_by",
            "performed_by_email",
            "created_at",
            "updated_at",
        ]


class StudentListSerializer(serializers.ModelSerializer):
    user = StudentUserBriefSerializer(read_only=True)
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "user",
            "full_name",
            "student_id",
            "enrollment_number",
            "status",
            "deactivated_at",
            "deactivated_by",
            "admission_date",
            "profile_completed",
            "city",
            "country",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class StudentSerializer(serializers.ModelSerializer):
    user = StudentUserBriefSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
        write_only=True,
        required=False,
    )
    guardians = GuardianSerializer(many=True, read_only=True)
    academic_history = AcademicHistorySerializer(many=True, read_only=True)
    documents = StudentDocumentSerializer(many=True, read_only=True)
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True, max_length=20)
    email = serializers.EmailField(write_only=True, required=False)

    class Meta:
        model = Student
        fields = [
            "id",
            "user",
            "user_id",
            "full_name",
            "first_name",
            "last_name",
            "name",
            "phone",
            "email",
            "student_id",
            "enrollment_number",
            "status",
            "deactivated_at",
            "deactivated_by",
            "blood_group",
            "nationality",
            "religion",
            "mother_tongue",
            "emergency_contact_name",
            "emergency_contact_phone",
            "notes",
            "admission_date",
            "profile_completed",
            "permanent_address",
            "temporary_address",
            "city",
            "district",
            "province",
            "country",
            "postal_code",
            "guardians",
            "academic_history",
            "documents",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "full_name",
            "deactivated_at",
            "deactivated_by",
            "guardians",
            "academic_history",
            "documents",
            "created_at",
            "updated_at",
        ]

    def validate_status(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if self.instance and value != self.instance.status:
            from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role

            if not user or not user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
                raise serializers.ValidationError("Only admins can change student status.")
        return value

    def validate_user_id(self, value):
        if self.instance is None and Student.objects.filter(user=value).exists():
            raise serializers.ValidationError("This user already has a student profile.")
        return value

    def create(self, validated_data):
        for key in ("first_name", "last_name", "name", "phone", "email"):
            validated_data.pop(key, None)
        user = validated_data.get("user")
        if user is None:
            raise serializers.ValidationError({"user_id": "This field is required."})
        return super().create(validated_data)

    def update(self, instance, validated_data):
        from apps.students.services import deactivate_student, reactivate_student

        name = (validated_data.pop("name", None) or "").strip()
        first_name = validated_data.pop("first_name", None)
        last_name = validated_data.pop("last_name", None)
        phone = validated_data.pop("phone", serializers.empty)
        email = validated_data.pop("email", None)
        next_status = validated_data.pop("status", serializers.empty)

        user = instance.user
        user_updates: list[str] = []
        if name and first_name is None:
            parts = name.split(None, 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else (user.last_name or "")
        if first_name is not None and user.first_name != first_name.strip():
            user.first_name = first_name.strip()
            user_updates.append("first_name")
        if last_name is not None and user.last_name != (last_name or "").strip():
            user.last_name = (last_name or "").strip()
            user_updates.append("last_name")
        if phone is not serializers.empty:
            next_phone = None if phone in ("", None) else str(phone).strip()
            if user.phone != next_phone:
                if next_phone and User.objects.filter(phone=next_phone).exclude(pk=user.pk).exists():
                    raise serializers.ValidationError({"phone": "A user with this phone already exists."})
                user.phone = next_phone
                user_updates.append("phone")
        if email is not None:
            next_email = email.lower().strip()
            if user.email.lower() != next_email:
                if User.objects.filter(email__iexact=next_email).exclude(pk=user.pk).exists():
                    raise serializers.ValidationError({"email": "A user with this email already exists."})
                user.email = next_email
                user_updates.append("email")
        if user_updates:
            user_updates.append("updated_at")
            user.save(update_fields=list(dict.fromkeys(user_updates)))

        student = super().update(instance, validated_data)

        if next_status is not serializers.empty and next_status != student.status:
            request = self.context.get("request")
            actor = getattr(request, "user", None) if request else None
            if next_status == Student.Status.INACTIVE:
                student = deactivate_student(student, performed_by=actor)
            elif next_status == Student.Status.ACTIVE:
                student = reactivate_student(student, performed_by=actor)

        return student

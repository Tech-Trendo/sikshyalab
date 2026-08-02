"""Serializers for the certificates module."""

from rest_framework import serializers

from apps.batches.models import Batch
from apps.certificates.models import (
    Certificate,
    CertificateSettings,
    CertificateTemplate,
    CertificateVerificationLog,
)
from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.students.models import Student


class CertificateTemplateSerializer(serializers.ModelSerializer):
    purpose_display = serializers.CharField(source="get_purpose_display", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True, allow_null=True)

    class Meta:
        model = CertificateTemplate
        fields = [
            "id",
            "name",
            "purpose",
            "purpose_display",
            "course",
            "course_title",
            "html_template",
            "is_default",
            "header_image",
            "background_image",
            "logo_image",
            "seal_image",
            "director_signature",
            "instructor_signature",
            "watermark_image",
            "footer_text",
            "design_config",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CertificateSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    course_title = serializers.CharField(source="course.title", read_only=True)
    batch_name = serializers.SerializerMethodField()
    template_name = serializers.CharField(source="template.name", read_only=True, allow_null=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    instructor_name = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "student",
            "student_name",
            "course",
            "course_title",
            "enrollment",
            "batch",
            "batch_name",
            "certificate_number",
            "verification_code",
            "qr_code",
            "issue_date",
            "completion_date",
            "grade_or_score",
            "title",
            "description",
            "status",
            "status_display",
            "issued_by",
            "pdf_file",
            "metadata",
            "template",
            "template_name",
            "instructor_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "certificate_number",
            "verification_code",
            "qr_code",
            "issued_by",
            "instructor_name",
            "created_at",
            "updated_at",
        ]

    def get_student_name(self, obj):
        user = getattr(obj.student, "user", None)
        if user is None:
            return ""
        return user.get_full_name()

    def get_batch_name(self, obj):
        if obj.batch_id and obj.batch:
            return getattr(obj.batch, "name", None) or getattr(obj.batch, "code", "")
        return ""

    def get_instructor_name(self, obj):
        return CertificatePublicSerializer().get_instructor_name(obj)


class CertificatePublicSerializer(serializers.ModelSerializer):
    """Public verification payload — no sensitive student contact info."""

    student_name = serializers.SerializerMethodField()
    course_title = serializers.CharField(source="course.title", read_only=True)
    batch_name = serializers.SerializerMethodField()
    institute_name = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()
    verification_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "certificate_number",
            "verification_code",
            "student_name",
            "course_title",
            "batch_name",
            "title",
            "description",
            "issue_date",
            "completion_date",
            "grade_or_score",
            "status",
            "duration",
            "instructor_name",
            "institute_name",
            "is_valid",
            "verification_url",
            "qr_code",
        ]

    def get_student_name(self, obj):
        user = getattr(obj.student, "user", None)
        if user is None:
            return ""
        return user.get_full_name()

    def get_batch_name(self, obj):
        if obj.batch_id and obj.batch:
            return getattr(obj.batch, "name", None) or getattr(obj.batch, "code", "")
        return ""

    def get_institute_name(self, obj):
        return CertificateSettings.get_solo().institute_name

    def get_duration(self, obj):
        meta = obj.metadata or {}
        if meta.get("duration"):
            return meta["duration"]
        course = getattr(obj, "course", None)
        return getattr(course, "duration", "") if course else ""

    def get_instructor_name(self, obj):
        meta = obj.metadata or {}
        if meta.get("instructor_name"):
            return meta["instructor_name"]
        if meta.get("supervisor_name"):
            return meta["supervisor_name"]
        course = getattr(obj, "course", None)
        if course is None:
            return ""
        link = (
            course.instructors.filter(is_primary=True)
            .select_related("teacher__user")
            .first()
        )
        if link is None:
            link = course.instructors.select_related("teacher__user").first()
        if link is None:
            return ""
        teacher = link.teacher
        user = getattr(teacher, "user", None)
        if user is not None:
            name = (user.get_full_name() or "").strip()
            if name:
                return name
        return str(teacher)

    def get_is_valid(self, obj):
        return obj.is_valid

    def get_verification_url(self, obj):
        from apps.certificates.services import get_verification_url

        return get_verification_url(obj.verification_code)


class CertificateVerificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificateVerificationLog
        fields = [
            "id",
            "certificate",
            "verified_at",
            "ip_address",
            "user_agent",
            "is_valid",
            "created_at",
        ]
        read_only_fields = fields


class CertificateSettingsSerializer(serializers.ModelSerializer):
    default_template_name = serializers.CharField(
        source="default_template.name", read_only=True, allow_null=True
    )

    class Meta:
        model = CertificateSettings
        fields = [
            "numbering_prefix",
            "numbering_format",
            "verification_base_url",
            "qr_size",
            "qr_embed_logo",
            "default_template",
            "default_template_name",
            "institute_name",
            "institute_tagline",
            "institute_address",
            "institute_website",
            "institute_email",
            "institute_phone",
            "institute_logo",
            "auto_generate_on_completion",
            "email_on_issue",
            "allow_public_verification",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class GenerateCertificateSerializer(serializers.Serializer):
    student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    template = serializers.PrimaryKeyRelatedField(
        queryset=CertificateTemplate.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    enrollment = serializers.PrimaryKeyRelatedField(
        queryset=Enrollment.objects.all(),
        required=False,
        allow_null=True,
    )
    batch = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.all(),
        required=False,
        allow_null=True,
    )
    completion_date = serializers.DateField(required=False)
    grade_or_score = serializers.CharField(
        required=False, allow_blank=True, max_length=50
    )
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    force = serializers.BooleanField(default=False)
    metadata = serializers.DictField(required=False)
    certificate_number = serializers.CharField(
        required=False, allow_blank=True, max_length=64
    )


class BulkGenerateCertificateSerializer(serializers.Serializer):
    template = serializers.PrimaryKeyRelatedField(
        queryset=CertificateTemplate.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    batch = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.all(),
        required=False,
        allow_null=True,
    )
    student_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
    )
    completion_date = serializers.DateField(required=False)
    grade_or_score = serializers.CharField(
        required=False, allow_blank=True, max_length=50
    )
    force = serializers.BooleanField(default=False)

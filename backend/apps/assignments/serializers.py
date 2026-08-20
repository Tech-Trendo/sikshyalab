"""Serializers for assignments."""

import logging
import mimetypes
from pathlib import Path

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers

from apps.assignments.models import (
    Assignment,
    AssignmentAllocation,
    AssignmentResource,
    Submission,
    SubmissionReview,
)
from apps.common.file_validators import validate_uploaded_file
from apps.common.media_utils import absolute_media_url, resolve_media_relpath
from apps.common.serializers_media import SafeMediaRepresentationMixin

logger = logging.getLogger(__name__)

_FILE_ALIASES = ("attachment", "file", "submitted_file")


def _uploaded_from_data(data):
    """Return the first non-empty upload from attachment / file / submitted_file."""
    for key in _FILE_ALIASES:
        if hasattr(data, "getlist"):
            values = [v for v in data.getlist(key) if v not in (None, "")]
            if values:
                return values[-1]
        value = data.get(key) if hasattr(data, "get") else None
        if value not in (None, ""):
            return value
    return None


def _delete_storage_file(name):
    if not name:
        return
    try:
        if default_storage.exists(name):
            default_storage.delete(name)
    except Exception:
        logger.warning("assignments.delete_storage_failed key=%s", name, exc_info=True)


def submitted_file_payload(instance, request):
    """Build {name, url, type, size} from Submission.attachment (or None)."""
    field = getattr(instance, "attachment", None)
    name = getattr(field, "name", None) if field else None
    if not name:
        return None
    rel = resolve_media_relpath(name, fallback_placeholder=False)
    url = absolute_media_url(request, rel) if rel else None
    basename = Path(name).name
    size = None
    try:
        size = field.size
    except Exception:
        size = None
    content_type, _ = mimetypes.guess_type(basename)
    return {
        "name": basename,
        "url": url,
        "type": content_type or "application/octet-stream",
        "size": size,
    }


class AssignmentResourceSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("file",)

    class Meta:
        model = AssignmentResource
        fields = [
            "id",
            "assignment",
            "title",
            "file",
            "link",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "file": {"required": False, "allow_null": True},
        }


class AssignmentAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssignmentAllocation
        fields = [
            "id",
            "assignment",
            "student",
            "batch",
            "allocated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "allocated_at", "created_at", "updated_at"]

    def validate(self, attrs):
        student = attrs.get("student", getattr(self.instance, "student", None))
        batch = attrs.get("batch", getattr(self.instance, "batch", None))
        if not student and not batch:
            raise serializers.ValidationError(
                "Provide either a student or a batch for allocation."
            )
        return attrs


class SubmissionReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionReview
        fields = [
            "id",
            "submission",
            "reviewer",
            "reviewer_teacher",
            "marks_obtained",
            "feedback",
            "graded_at",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reviewer",
            "reviewer_teacher",
            "graded_at",
            "created_at",
            "updated_at",
        ]


class SubmissionSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    """Student/teacher submission payload. File lives on ``attachment``."""

    safe_media_fields = ("attachment",)
    review = SubmissionReviewSerializer(read_only=True)
    submitted_file = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "student",
            "content",
            "attachment",
            "submitted_file",
            "submitted_at",
            "status",
            "attempt_number",
            "review",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "submitted_at",
            "status",
            "attempt_number",
            "review",
            "submitted_file",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "student": {"required": False, "allow_null": True},
            "content": {"required": False, "allow_blank": True},
            "attachment": {"required": False, "allow_null": True},
        }
        # UniqueTogether(assignment, student, attempt_number) would force
        # clients to send student; the view sets both after auth.
        validators = []

    def get_submitted_file(self, instance):
        return submitted_file_payload(instance, self.context.get("request"))

    def to_internal_value(self, data):
        uploaded = _uploaded_from_data(data)
        if uploaded is not None:
            if hasattr(data, "_mutable"):
                was_mutable = data._mutable
                data._mutable = True
                data["attachment"] = uploaded
                data._mutable = was_mutable
            else:
                try:
                    data = data.copy()
                except Exception:
                    data = dict(data)
                data["attachment"] = uploaded
        return super().to_internal_value(data)

    def validate_attachment(self, value):
        if not value:
            return value
        try:
            validate_uploaded_file(value, kind="media")
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value

    def update(self, instance, validated_data):
        old_name = instance.attachment.name if instance.attachment else ""
        instance = super().update(instance, validated_data)
        new_name = instance.attachment.name if instance.attachment else ""
        if old_name and old_name != new_name:
            _delete_storage_file(old_name)
        return instance


class GradeSubmissionSerializer(serializers.Serializer):
    marks_obtained = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=0)
    feedback = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=SubmissionReview.Status.choices,
        default=SubmissionReview.Status.PUBLISHED,
    )


class AssignmentSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("attachment",)
    resources = AssignmentResourceSerializer(many=True, read_only=True)
    allocations = AssignmentAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "title",
            "description",
            "course",
            "batch",
            "teacher",
            "instructions",
            "attachment",
            "due_date",
            "max_marks",
            "grading_criteria",
            "status",
            "allow_late_submission",
            "resources",
            "allocations",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "attachment": {"required": False, "allow_null": True},
        }
        read_only_fields = ["id", "created_at", "updated_at", "resources", "allocations"]


def next_attempt_number(assignment, student):
    current = (
        Submission.objects.filter(assignment=assignment, student=student).aggregate(
            Max("attempt_number")
        )["attempt_number__max"]
        or 0
    )
    return current + 1


def determine_submission_status(assignment, submitted_at=None):
    submitted_at = submitted_at or timezone.now()
    if submitted_at > assignment.due_date:
        if not assignment.allow_late_submission:
            raise serializers.ValidationError("Late submissions are not allowed.")
        return Submission.Status.LATE
    return Submission.Status.SUBMITTED

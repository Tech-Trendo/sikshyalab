"""Serializers for assignments."""

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


class AssignmentResourceSerializer(serializers.ModelSerializer):
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


class SubmissionSerializer(serializers.ModelSerializer):
    review = SubmissionReviewSerializer(read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "student",
            "content",
            "attachment",
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
            "created_at",
            "updated_at",
        ]


class GradeSubmissionSerializer(serializers.Serializer):
    marks_obtained = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=0)
    feedback = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=SubmissionReview.Status.choices,
        default=SubmissionReview.Status.PUBLISHED,
    )


class AssignmentSerializer(serializers.ModelSerializer):
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

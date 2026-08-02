"""DRF viewsets for assignments."""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated

from apps.assignments.models import (
    Assignment,
    AssignmentAllocation,
    AssignmentResource,
    Submission,
    SubmissionReview,
)
from apps.assignments.permissions import (
    IsAssignmentAdminOrTeacher,
    IsAssignmentParticipant,
    get_student_for_user,
    get_teacher_for_user,
)
from apps.assignments.serializers import (
    AssignmentAllocationSerializer,
    AssignmentResourceSerializer,
    AssignmentSerializer,
    GradeSubmissionSerializer,
    SubmissionReviewSerializer,
    SubmissionSerializer,
    determine_submission_status,
    next_attempt_number,
)
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, user_has_role
from apps.common.responses import created_response, error_response, success_response


def student_is_allocated(assignment, student):
    if student is None:
        return False
    qs = AssignmentAllocation.objects.filter(assignment=assignment)
    if qs.filter(student=student).exists():
        return True

    membership_batch_ids = student_visible_batch_ids(student)
    if qs.filter(batch_id__in=membership_batch_ids).exists():
        return True

    # No allocations → fall back to the assignment's own batch
    if not qs.exists() and assignment.batch_id and assignment.batch_id in membership_batch_ids:
        return True
    return False


def student_visible_batch_ids(student):
    """Batches the student belongs to via membership and/or enrollment."""
    batch_ids = set()
    try:
        from apps.batches.models import BatchStudent

        batch_ids.update(
            BatchStudent.objects.filter(student=student).values_list("batch_id", flat=True)
        )
    except Exception:
        pass
    try:
        from apps.enrollments.models import Enrollment

        batch_ids.update(
            Enrollment.objects.filter(
                student=student,
                batch__isnull=False,
                status__in=[
                    Enrollment.Status.PENDING,
                    Enrollment.Status.APPROVED,
                    Enrollment.Status.ACTIVE,
                    Enrollment.Status.SUSPENDED,
                ],
            ).values_list("batch_id", flat=True)
        )
    except Exception:
        pass
    return batch_ids


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated, IsAssignmentParticipant]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["course", "batch", "teacher", "status"]
    search_fields = ["title", "description", "instructions"]
    ordering_fields = ["due_date", "created_at", "title", "max_marks"]
    ordering = ["-created_at"]

    def get_queryset(self):
        Assignment.objects.filter(
            status=Assignment.Status.PUBLISHED,
            due_date__lte=timezone.now(),
        ).update(status=Assignment.Status.CLOSED)
        qs = Assignment.objects.select_related("course", "batch", "teacher").prefetch_related(
            "resources", "allocations"
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(teacher=teacher)
        student = get_student_for_user(user)
        if student:
            from django.db.models import Exists, OuterRef

            membership_batch_ids = student_visible_batch_ids(student)
            allocated_to_student = AssignmentAllocation.objects.filter(
                assignment_id=OuterRef("pk"),
                student=student,
            )
            allocated_to_batch = AssignmentAllocation.objects.filter(
                assignment_id=OuterRef("pk"),
                batch_id__in=membership_batch_ids,
            )
            has_any_allocation = AssignmentAllocation.objects.filter(
                assignment_id=OuterRef("pk"),
            )
            # Prefer explicit allocations when present; otherwise fall back to assignment.batch.
            return qs.filter(
                Q(Exists(allocated_to_student))
                | Q(Exists(allocated_to_batch))
                | (
                    Q(~Exists(has_any_allocation))
                    & Q(batch_id__in=membership_batch_ids)
                )
            ).distinct()
        return qs.none()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "publish", "close"):
            return [IsAuthenticated(), IsAssignmentAdminOrTeacher()]
        return super().get_permissions()

    def perform_create(self, serializer):
        teacher = get_teacher_for_user(self.request.user)
        if teacher and "teacher" not in serializer.validated_data:
            serializer.save(teacher=teacher)
        else:
            serializer.save()

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        assignment = self.get_object()
        assignment.status = Assignment.Status.PUBLISHED
        assignment.save(update_fields=["status", "updated_at"])
        return success_response(data=AssignmentSerializer(assignment).data)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        assignment = self.get_object()
        assignment.status = Assignment.Status.CLOSED
        assignment.save(update_fields=["status", "updated_at"])
        return success_response(data=AssignmentSerializer(assignment).data)


class AssignmentResourceViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentResourceSerializer
    permission_classes = [IsAuthenticated, IsAssignmentParticipant]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["assignment"]
    search_fields = ["title", "link"]
    ordering = ["title"]

    def get_queryset(self):
        qs = AssignmentResource.objects.select_related("assignment", "assignment__teacher")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(assignment__teacher=teacher)
        student = get_student_for_user(user)
        if student:
            return qs.filter(assignment__status=Assignment.Status.PUBLISHED)
        return qs.none()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAssignmentAdminOrTeacher()]
        return super().get_permissions()


class AssignmentAllocationViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentAllocationSerializer
    permission_classes = [IsAuthenticated, IsAssignmentAdminOrTeacher]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["assignment", "student", "batch"]
    ordering = ["-allocated_at"]

    def get_queryset(self):
        qs = AssignmentAllocation.objects.select_related("assignment", "student", "batch")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(assignment__teacher=teacher)
        return qs.none()


class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated, IsAssignmentParticipant]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["assignment", "student", "status"]
    search_fields = ["content"]
    ordering_fields = ["submitted_at", "attempt_number"]
    ordering = ["-submitted_at"]

    def get_queryset(self):
        qs = Submission.objects.select_related(
            "assignment", "assignment__teacher", "student"
        ).prefetch_related("review")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(assignment__teacher=teacher)
        student = get_student_for_user(user)
        if student:
            return qs.filter(student=student)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if not user_has_role(request.user, ROLE_STUDENT, ROLE_ADMIN, ROLE_STAFF):
            return error_response(
                message="Only students can submit assignments.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        student = get_student_for_user(request.user)
        if student is None and not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return error_response(
                message="Student profile not found.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = serializer.validated_data["assignment"]

        if assignment.status != Assignment.Status.PUBLISHED:
            return error_response(message="Assignment is not open for submissions.")

        target_student = serializer.validated_data.get("student") or student
        if user_has_role(request.user, ROLE_STUDENT) and target_student != student:
            return error_response(
                message="You can only submit as yourself.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if student and not user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            if not student_is_allocated(assignment, target_student):
                # Soft check: allow if no allocations exist (open to course/batch)
                if AssignmentAllocation.objects.filter(assignment=assignment).exists():
                    return error_response(
                        message="You are not allocated to this assignment.",
                        status_code=status.HTTP_403_FORBIDDEN,
                    )

        try:
            sub_status = determine_submission_status(assignment)
        except Exception as exc:
            return error_response(message=str(exc))

        attempt = next_attempt_number(assignment, target_student)
        if attempt > 1:
            sub_status = Submission.Status.RESUBMITTED if sub_status == Submission.Status.SUBMITTED else sub_status

        submission = serializer.save(
            student=target_student,
            status=sub_status,
            attempt_number=attempt,
        )
        return created_response(
            data=SubmissionSerializer(submission).data,
            message="Submission recorded.",
        )

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAssignmentAdminOrTeacher()]
        if self.action == "grade":
            return [IsAuthenticated(), IsAssignmentAdminOrTeacher()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="grade")
    def grade(self, request, pk=None):
        submission = self.get_object()
        serializer = GradeSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        teacher = get_teacher_for_user(request.user)

        if data["marks_obtained"] > submission.assignment.max_marks:
            return error_response(
                message=f"Marks cannot exceed max marks ({submission.assignment.max_marks})."
            )

        with transaction.atomic():
            review, _ = SubmissionReview.objects.update_or_create(
                submission=submission,
                defaults={
                    "reviewer": request.user,
                    "reviewer_teacher": teacher,
                    "marks_obtained": data["marks_obtained"],
                    "feedback": data.get("feedback", ""),
                    "status": data.get("status", SubmissionReview.Status.PUBLISHED),
                    "graded_at": timezone.now(),
                },
            )
            submission.status = Submission.Status.GRADED
            if review.status == SubmissionReview.Status.RETURNED:
                submission.status = Submission.Status.RETURNED
            submission.save(update_fields=["status", "updated_at"])

        return success_response(
            data={
                "submission": SubmissionSerializer(submission).data,
                "review": SubmissionReviewSerializer(review).data,
            },
            message="Submission graded.",
        )


class SubmissionReviewViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionReviewSerializer
    permission_classes = [IsAuthenticated, IsAssignmentParticipant]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["submission", "status", "reviewer", "reviewer_teacher"]
    ordering = ["-graded_at"]

    def get_queryset(self):
        qs = SubmissionReview.objects.select_related(
            "submission",
            "submission__assignment",
            "submission__student",
            "reviewer",
            "reviewer_teacher",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        teacher = get_teacher_for_user(user)
        if teacher:
            return qs.filter(submission__assignment__teacher=teacher)
        student = get_student_for_user(user)
        if student:
            return qs.filter(submission__student=student)
        return qs.none()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAssignmentAdminOrTeacher()]
        return super().get_permissions()

    def perform_create(self, serializer):
        teacher = get_teacher_for_user(self.request.user)
        serializer.save(reviewer=self.request.user, reviewer_teacher=teacher)

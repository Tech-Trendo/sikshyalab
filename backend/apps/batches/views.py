"""
DRF viewsets for batches & shifts.
"""

from django.db.models import Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import IsAdminRole
from apps.batches.filters import (
    BatchFilter,
    BatchScheduleFilter,
    BatchStudentFilter,
    ShiftFilter,
)
from apps.batches.models import Batch, BatchSchedule, BatchStudent, Shift
from apps.batches.permissions import BatchAccessPermission, _get_student, _get_teacher
from apps.batches.serializers import (
    BatchListSerializer,
    BatchScheduleSerializer,
    BatchSerializer,
    BatchStudentSerializer,
    PublicUpcomingBatchSerializer,
    ShiftSerializer,
)
from apps.batches.services import add_student_to_batch, drop_student_from_batch, refresh_batch_enrolled_count
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, ROLE_TEACHER, user_has_role
from apps.common.responses import success_response


class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ShiftFilter
    search_fields = ["name", "code", "description"]
    ordering_fields = ["name", "code", "start_time", "created_at"]
    ordering = ["start_time", "name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Shift.objects.all()
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER):
            return qs
        return qs.filter(is_active=True)


class BatchViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, BatchAccessPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BatchFilter
    search_fields = ["name", "code", "room_number", "description"]
    ordering_fields = ["start_date", "name", "code", "created_at", "enrolled_count"]
    ordering = ["-start_date", "name"]

    def get_queryset(self):
        qs = Batch.objects.select_related(
            "course",
            "shift",
            "teacher",
            "teacher__user",
            "created_by",
        ).prefetch_related(
            Prefetch("schedules", queryset=BatchSchedule.objects.order_by("day_of_week", "start_time"))
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = _get_teacher(user)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(teacher=teacher)
                | Q(course__instructors__teacher=teacher)
                | Q(course__created_by=user)
            ).distinct()
        if user_has_role(user, ROLE_STUDENT):
            student = _get_student(user)
            if student is None:
                return qs.none()
            return qs.filter(
                batch_students__student=student,
                batch_students__status=BatchStudent.Status.ACTIVE,
            ).distinct()
        return qs.none()

    def get_serializer_class(self):
        if self.action == "list":
            return BatchListSerializer
        return BatchSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(
        detail=False,
        methods=["get"],
        url_path="upcoming",
        permission_classes=[AllowAny],
        authentication_classes=[],
    )
    def upcoming(self, request):
        """Public list of upcoming (and ongoing) batches for published courses."""
        qs = (
            Batch.objects.select_related("course", "shift")
            .filter(
                status__in=[Batch.Status.UPCOMING, Batch.Status.ONGOING],
                course__is_published=True,
                is_deleted=False,
            )
            .order_by("start_date", "name")
        )
        data = PublicUpcomingBatchSerializer(qs, many=True).data
        return success_response(data=data, message="Upcoming batches loaded.")

    @action(detail=True, methods=["post"], url_path="add-student")
    def add_student(self, request, pk=None):
        batch = self.get_object()
        student_id = request.data.get("student")
        notes = request.data.get("notes", "")
        if not student_id:
            return Response(
                {"detail": "student is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.students.models import Student

        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found."}, status=status.HTTP_404_NOT_FOUND)

        if batch.is_full and not BatchStudent.objects.filter(
            batch=batch, student=student, status=BatchStudent.Status.ACTIVE
        ).exists():
            return Response(
                {"detail": "Batch is at full capacity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = add_student_to_batch(batch=batch, student=student, notes=notes)
        return Response(BatchStudentSerializer(membership).data)

    @action(detail=True, methods=["post"], url_path="remove-student")
    def remove_student(self, request, pk=None):
        batch = self.get_object()
        student_id = request.data.get("student")
        notes = request.data.get("notes", "")
        if not student_id:
            return Response(
                {"detail": "student is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.students.models import Student

        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found."}, status=status.HTTP_404_NOT_FOUND)

        membership = drop_student_from_batch(batch=batch, student=student, notes=notes)
        if membership is None:
            return Response(
                {"detail": "Student is not in this batch."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(BatchStudentSerializer(membership).data)

    @action(detail=True, methods=["post"], url_path="refresh-count")
    def refresh_count(self, request, pk=None):
        batch = self.get_object()
        count = refresh_batch_enrolled_count(batch)
        return Response({"enrolled_count": count})


class BatchStudentViewSet(viewsets.ModelViewSet):
    serializer_class = BatchStudentSerializer
    permission_classes = [IsAuthenticated, BatchAccessPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BatchStudentFilter
    search_fields = ["student__student_id", "notes", "batch__code"]
    ordering_fields = ["enrolled_at", "status"]
    ordering = ["-enrolled_at"]

    def get_queryset(self):
        qs = BatchStudent.objects.select_related(
            "batch",
            "student",
            "student__user",
            "batch__teacher",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = _get_teacher(user)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(batch__teacher=teacher)
                | Q(batch__course__instructors__teacher=teacher)
            ).distinct()
        if user_has_role(user, ROLE_STUDENT):
            student = _get_student(user)
            if student is None:
                return qs.none()
            return qs.filter(student=student)
        return qs.none()

    def perform_create(self, serializer):
        membership = serializer.save()
        refresh_batch_enrolled_count(membership.batch)

    def perform_update(self, serializer):
        membership = serializer.save()
        refresh_batch_enrolled_count(membership.batch)

    def perform_destroy(self, instance):
        batch = instance.batch
        instance.delete()
        refresh_batch_enrolled_count(batch)


class BatchScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = BatchScheduleSerializer
    permission_classes = [IsAuthenticated, BatchAccessPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = BatchScheduleFilter
    ordering_fields = ["day_of_week", "start_time"]
    ordering = ["day_of_week", "start_time"]

    def get_queryset(self):
        qs = BatchSchedule.objects.select_related("batch", "batch__teacher")
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            teacher = _get_teacher(user)
            if teacher is None:
                return qs.none()
            return qs.filter(
                Q(batch__teacher=teacher)
                | Q(batch__course__instructors__teacher=teacher)
            ).distinct()
        if user_has_role(user, ROLE_STUDENT):
            student = _get_student(user)
            if student is None:
                return qs.none()
            return qs.filter(
                batch__batch_students__student=student,
                batch__batch_students__status=BatchStudent.Status.ACTIVE,
            ).distinct()
        return qs.none()

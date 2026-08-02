"""Task board API — mirrors frontend teacher/student task rules."""

from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_STUDENT,
    ROLE_TEACHER,
    user_has_role,
)
from apps.common.responses import created_response
from apps.tasks.models import BoardTask
from apps.tasks.serializers import BoardTaskSerializer


class BoardTaskViewSet(viewsets.ModelViewSet):
    serializer_class = BoardTaskSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "student", "course"]
    search_fields = ["title", "course_title", "assigned_by"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = BoardTask.objects.select_related(
            "student", "student__user", "course", "created_by"
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        if user_has_role(user, ROLE_TEACHER):
            return qs.filter(
                Q(student__batch_memberships__batch__teacher__user=user)
                | Q(created_by=user)
            ).distinct()
        if user_has_role(user, ROLE_STUDENT):
            return qs.filter(student__user=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        role = "admin"
        if user_has_role(user, ROLE_TEACHER):
            role = "teacher"
        elif user_has_role(user, ROLE_STUDENT):
            role = "student"
        assigned_by = ""
        if role == "teacher":
            assigned_by = user.get_full_name() or user.email
        serializer.save(
            created_by=user,
            created_by_role=role,
            assigned_by=assigned_by or serializer.validated_data.get("assigned_by", ""),
        )

    def destroy(self, request, *args, **kwargs):
        # Students cannot delete tasks (frontend rule)
        if user_has_role(request.user, ROLE_STUDENT) and not user_has_role(
            request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER
        ):
            return Response(
                {"detail": "Students cannot delete tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request):
        """
        Assign the same task to students in one or more batches (by batch code)
        or to an explicit list of student display IDs.
        """
        if user_has_role(request.user, ROLE_STUDENT) and not user_has_role(
            request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER
        ):
            return Response(
                {"detail": "Students cannot bulk-assign tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        title = (request.data.get("title") or "").strip()
        course_title = request.data.get("course") or request.data.get("course_title") or ""
        due = request.data.get("due") or "TBD"
        batch_codes = request.data.get("batch_ids") or []
        student_codes = request.data.get("student_ids") or []
        assigned_by = request.data.get("assigned_by") or ""

        if not title:
            return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.batches.models import Batch, BatchStudent
        from apps.courses.models import Course
        from apps.students.models import Student

        students = []
        if batch_codes:
            batches = Batch.objects.filter(code__in=batch_codes)
            if hasattr(Batch, "is_deleted"):
                batches = batches.filter(is_deleted=False)
            membership_qs = BatchStudent.objects.filter(batch__in=batches)
            if hasattr(BatchStudent, "is_deleted"):
                membership_qs = membership_qs.filter(is_deleted=False)
            student_pks = set(membership_qs.values_list("student_id", flat=True))

            # Also include students actively enrolled in these batches
            # (enrollment may exist without a BatchStudent row).
            from apps.enrollments.models import Enrollment

            enrolled_pks = Enrollment.objects.filter(
                batch__in=batches,
                status__in=[
                    Enrollment.Status.PENDING,
                    Enrollment.Status.APPROVED,
                    Enrollment.Status.ACTIVE,
                    Enrollment.Status.SUSPENDED,
                ],
            ).values_list("student_id", flat=True)
            student_pks.update(enrolled_pks)
            students = list(Student.objects.filter(pk__in=student_pks))
        elif student_codes:
            students = list(Student.objects.filter(student_id__in=student_codes))
        else:
            return Response(
                {"detail": "Provide batch_ids or student_ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not students:
            return Response(
                {"detail": "No students matched the given batches or IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        course = None
        if course_title:
            course = Course.objects.filter(title__iexact=course_title).first()

        user = request.user
        role = "admin"
        if user_has_role(user, ROLE_TEACHER):
            role = "teacher"
        if not assigned_by:
            assigned_by = user.get_full_name() or user.email

        created_tasks = []
        with transaction.atomic():
            for student in students:
                task = BoardTask.objects.create(
                    title=title,
                    course=course,
                    course_title=course_title or (course.title if course else ""),
                    due=due,
                    status=BoardTask.Status.TO_DO,
                    student=student,
                    created_by=user,
                    created_by_role=role,
                    assigned_by=assigned_by,
                )
                created_tasks.append(task)

        return created_response(
            data={
                "count": len(created_tasks),
                "tasks": BoardTaskSerializer(created_tasks, many=True).data,
            },
            message=f"Assigned task to {len(created_tasks)} student(s).",
        )

    @action(detail=True, methods=["post"], url_path="advance")
    def advance(self, request, pk=None):
        """Forward-only status: To Do → In Progress → Submitted → Completed."""
        task = self.get_object()
        if user_has_role(request.user, ROLE_STUDENT):
            if getattr(task.student, "user_id", None) != request.user.id:
                return Response(
                    {"detail": "Not your task."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        if not task.advance():
            return Response(
                {"detail": "Task cannot move backwards or past Completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(BoardTaskSerializer(task).data)

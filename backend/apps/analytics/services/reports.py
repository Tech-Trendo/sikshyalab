"""Analytics trend and report helpers."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.analytics.services._common import (
    _get_model,
    _iter_months,
    logger,
    teacher_scope_filters,
)

def enrollment_trends(months: int = 12, user=None) -> list[dict]:
    Enrollment = _get_model("enrollments.Enrollment")
    scope = teacher_scope_filters(user) if user is not None else None
    series = []
    for year, month, start, end in _iter_months(months):
        count = 0
        if Enrollment:
            try:
                qs = Enrollment.objects.filter(created_at__gte=start, created_at__lte=end)
                if scope and scope.get("teacher"):
                    qs = qs.filter(
                        Q(batch__teacher=scope["teacher"])
                        | Q(course__instructors__teacher=scope["teacher"])
                    ).distinct()
                count = qs.count()
            except Exception:
                count = 0
        series.append(
            {
                "year": year,
                "month": month,
                "label": f"{year}-{month:02d}",
                "count": count,
            }
        )
    return series


def student_growth(months: int = 12, user=None) -> list[dict]:
    Student = _get_model("students.Student")
    series = []
    cumulative = 0
    for year, month, start, end in _iter_months(months):
        new_count = 0
        if Student:
            try:
                qs = Student.objects.filter(created_at__gte=start, created_at__lte=end)
                if hasattr(Student, "is_deleted"):
                    qs = qs.filter(is_deleted=False)
                scope = teacher_scope_filters(user) if user is not None else None
                if scope and scope.get("teacher"):
                    BatchStudent = _get_model("batches.BatchStudent")
                    if BatchStudent:
                        student_ids = BatchStudent.objects.filter(
                            batch__teacher=scope["teacher"],
                            created_at__gte=start,
                            created_at__lte=end,
                            is_deleted=False,
                        ).values_list("student_id", flat=True)
                        new_count = len(set(student_ids))
                    else:
                        new_count = 0
                else:
                    new_count = qs.count()
            except Exception:
                new_count = 0
        cumulative += new_count
        series.append(
            {
                "year": year,
                "month": month,
                "label": f"{year}-{month:02d}",
                "new_students": new_count,
                "cumulative": cumulative,
            }
        )
    return series


def revenue_summary(months: int = 12, user=None) -> dict:
    Payment = _get_model("fees.Payment")
    scope = teacher_scope_filters(user) if user is not None else None
    monthly = []
    grand_total = Decimal("0.00")

    for year, month, start, end in _iter_months(months):
        total = Decimal("0.00")
        count = 0
        if Payment:
            try:
                qs = Payment.objects.filter(
                    status="SUCCESS",
                    paid_at__gte=start,
                    paid_at__lte=end,
                )
                if hasattr(Payment, "is_deleted"):
                    qs = qs.filter(is_deleted=False)
                if scope and scope.get("teacher"):
                    qs = qs.filter(
                        Q(student_fee__course__instructors__teacher=scope["teacher"])
                        | Q(student_fee__enrollment__batch__teacher=scope["teacher"])
                    ).distinct()
                agg = qs.aggregate(total=Sum("amount"), count=Count("id"))
                total = agg["total"] or Decimal("0.00")
                count = agg["count"] or 0
            except Exception:
                total = Decimal("0.00")
                count = 0
        grand_total += total
        monthly.append(
            {
                "year": year,
                "month": month,
                "label": f"{year}-{month:02d}",
                "total": str(total),
                "payment_count": count,
            }
        )

    this_month = monthly[-1]["total"] if monthly else "0.00"

    today_total = Decimal("0.00")
    week_total = Decimal("0.00")
    year_total = Decimal("0.00")
    outstanding = Decimal("0.00")
    by_course = []
    by_batch = []

    if Payment:
        try:
            now = timezone.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            today_total = (
                Payment.objects.filter(
                    status="SUCCESS", paid_at__gte=today_start
                ).aggregate(t=Sum("amount"))["t"]
                or Decimal("0.00")
            )

            monday = today_start - timedelta(days=now.weekday())
            week_total = (
                Payment.objects.filter(
                    status="SUCCESS", paid_at__gte=monday
                ).aggregate(t=Sum("amount"))["t"]
                or Decimal("0.00")
            )

            year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            year_total = (
                Payment.objects.filter(
                    status="SUCCESS", paid_at__gte=year_start
                ).aggregate(t=Sum("amount"))["t"]
                or Decimal("0.00")
            )
        except Exception:
            pass

    StudentFee = _get_model("fees.StudentFee")
    if StudentFee:
        try:
            outstanding = (
                StudentFee.objects.filter(
                    status__in=["PENDING", "PARTIAL", "OVERDUE"]
                ).aggregate(t=Sum("due_amount"))["t"]
                or Decimal("0.00")
            )
        except Exception:
            pass

    if Payment:
        try:
            for row in (
                Payment.objects.filter(status="SUCCESS")
                .values("student_fee__course__title")
                .annotate(total=Sum("amount"))
                .order_by("-total")
            ):
                name = row["student_fee__course__title"] or "Unknown"
                by_course.append({"course_name": name, "total": str(row["total"])})

            for row in (
                Payment.objects.filter(status="SUCCESS")
                .values("student_fee__enrollment__batch__code")
                .annotate(total=Sum("amount"))
                .order_by("-total")
            ):
                code = row["student_fee__enrollment__batch__code"] or "Unknown"
                by_batch.append({"batch_code": code, "total": str(row["total"])})
        except Exception:
            pass

    return {
        "months": months,
        "grand_total": str(grand_total),
        "this_month": this_month,
        "today": str(today_total),
        "this_week": str(week_total),
        "this_year": str(year_total),
        "outstanding": str(outstanding),
        "by_course": by_course,
        "by_batch": by_batch,
        "series": monthly,
    }


def assignment_completion(user=None) -> dict:
    Assignment = _get_model("assignments.Assignment")
    Submission = _get_model("assignments.Submission")
    AssignmentAllocation = _get_model("assignments.AssignmentAllocation")
    scope = teacher_scope_filters(user) if user is not None else None

    total_assignments = 0
    published = 0
    total_submissions = 0
    graded = 0
    per_assignment = []

    if Assignment:
        try:
            qs = Assignment.objects.all()
            if hasattr(Assignment, "is_deleted"):
                qs = qs.filter(is_deleted=False)
            if scope and scope.get("teacher"):
                qs = qs.filter(teacher=scope["teacher"])
            total_assignments = qs.count()
            published = qs.filter(status="PUBLISHED").count()

            for assignment in qs.select_related("course", "batch")[:100]:
                sub_qs = Submission.objects.filter(assignment=assignment) if Submission else None
                sub_count = sub_qs.count() if sub_qs is not None else 0
                graded_count = (
                    sub_qs.filter(status="GRADED").count() if sub_qs is not None else 0
                )
                allocated = 0
                if AssignmentAllocation:
                    allocated = AssignmentAllocation.objects.filter(
                        assignment=assignment
                    ).count()
                per_assignment.append(
                    {
                        "id": str(assignment.pk),
                        "title": assignment.title,
                        "status": assignment.status,
                        "allocated": allocated,
                        "submissions": sub_count,
                        "graded": graded_count,
                        "completion_rate": round((sub_count / allocated) * 100, 2)
                        if allocated
                        else None,
                    }
                )
                total_submissions += sub_count
                graded += graded_count
        except Exception:
            logger.exception("Assignment completion failed")

    return {
        "total_assignments": total_assignments,
        "published": published,
        "total_submissions": total_submissions,
        "graded": graded,
        "assignments": per_assignment,
    }


def certificate_stats(user=None) -> dict:
    Certificate = _get_model("certificates.Certificate")
    scope = teacher_scope_filters(user) if user is not None else None
    from apps.common.permissions import ROLE_STUDENT, user_has_role

    if Certificate is None:
        return {
            "available": False,
            "total": 0,
            "message": "Certificates module not yet configured.",
        }

    try:
        qs = Certificate.objects.all()
        if hasattr(Certificate, "is_deleted"):
            qs = qs.filter(is_deleted=False)
        if user is not None and user_has_role(user, ROLE_STUDENT):
            Student = _get_model("students.Student")
            student = Student.objects.filter(user=user).first() if Student else None
            qs = qs.filter(student=student) if student else qs.none()
        elif scope and scope.get("teacher"):
            qs = qs.filter(
                Q(course__instructors__teacher=scope["teacher"])
                | Q(batch__teacher=scope["teacher"])
            ).distinct()

        total = qs.count()
        by_status = {}
        if hasattr(Certificate, "status"):
            for row in qs.values("status").annotate(count=Count("id")):
                by_status[row["status"] or "UNKNOWN"] = row["count"]

        recent = []
        order_field = "created_at" if hasattr(Certificate, "created_at") else "pk"
        for cert in qs.order_by(f"-{order_field}")[:10]:
            recent.append(
                {
                    "id": str(cert.pk),
                    "number": getattr(cert, "certificate_number", None)
                    or getattr(cert, "code", ""),
                    "status": getattr(cert, "status", None),
                }
            )

        return {
            "available": True,
            "total": total,
            "by_status": by_status,
            "recent": recent,
        }
    except Exception:
        logger.exception("Certificate stats failed")
        return {"available": False, "total": 0, "message": "Unable to load certificate stats."}


def teacher_performance(user=None) -> list[dict]:
    Teacher = _get_model("teachers.Teacher")
    Batch = _get_model("batches.Batch")
    Assignment = _get_model("assignments.Assignment")
    Enrollment = _get_model("enrollments.Enrollment")

    if Teacher is None:
        return []

    scope = teacher_scope_filters(user) if user is not None else None
    results = []

    try:
        teachers_qs = Teacher.objects.all()
        if hasattr(Teacher, "is_deleted"):
            teachers_qs = teachers_qs.filter(is_deleted=False)
        if scope and scope.get("teacher"):
            teachers_qs = teachers_qs.filter(pk=scope["teacher"].pk)
        elif scope == {}:
            return []

        for teacher in teachers_qs.select_related("user")[:200]:
            batches_count = 0
            ongoing = 0
            assignments_count = 0
            enrollments_count = 0

            if Batch:
                bqs = Batch.objects.filter(teacher=teacher)
                if hasattr(Batch, "is_deleted"):
                    bqs = bqs.filter(is_deleted=False)
                batches_count = bqs.count()
                ongoing = bqs.filter(status="ONGOING").count()

            if Assignment:
                aqs = Assignment.objects.filter(teacher=teacher)
                if hasattr(Assignment, "is_deleted"):
                    aqs = aqs.filter(is_deleted=False)
                assignments_count = aqs.count()

            if Enrollment:
                try:
                    enrollments_count = Enrollment.objects.filter(
                        batch__teacher=teacher,
                        status__in=["ACTIVE", "APPROVED", "COMPLETED"],
                    ).count()
                except Exception:
                    enrollments_count = 0

            results.append(
                {
                    "teacher_id": getattr(teacher, "teacher_id", str(teacher.pk)),
                    "id": str(teacher.pk),
                    "name": teacher.user.get_full_name()
                    if getattr(teacher, "user", None)
                    else str(teacher),
                    "email": getattr(getattr(teacher, "user", None), "email", ""),
                    "batches": batches_count,
                    "ongoing_batches": ongoing,
                    "assignments": assignments_count,
                    "enrollments": enrollments_count,
                    "status": getattr(teacher, "status", None),
                }
            )
    except Exception:
        logger.exception("Teacher performance failed")

    return results


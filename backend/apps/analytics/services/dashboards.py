"""Role-aware dashboard KPI payloads."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from apps.analytics.services._common import (
    _get_model,
    _month_start,
    _resolve_role,
    _safe_count,
    logger,
    teacher_scope_filters,
)

def _admin_dashboard() -> dict:
    Student = _get_model("students.Student")
    Teacher = _get_model("teachers.Teacher")
    Course = _get_model("courses.Course")
    Batch = _get_model("batches.Batch")
    Enrollment = _get_model("enrollments.Enrollment")
    Payment = _get_model("fees.Payment")
    Certificate = _get_model("certificates.Certificate")

    students = _safe_count(Student)
    teachers = _safe_count(Teacher)
    courses = _safe_count(Course)
    active_batches = _safe_count(Batch, status="ONGOING")
    pending_enrollments = 0
    if Enrollment:
        try:
            pending_enrollments = Enrollment.objects.filter(status="PENDING").count()
        except Exception:
            pending_enrollments = 0

    revenue_this_month = Decimal("0.00")
    month_start = _month_start()
    if Payment:
        try:
            qs = Payment.objects.filter(status="SUCCESS", paid_at__gte=month_start)
            if hasattr(Payment, "is_deleted"):
                qs = qs.filter(is_deleted=False)
            agg = qs.aggregate(total=Sum("amount"))
            revenue_this_month = agg["total"] or Decimal("0.00")
        except Exception:
            revenue_this_month = Decimal("0.00")

    certificates_issued = _safe_count(Certificate)

    return {
        "role": "admin",
        "students": students,
        "teachers": teachers,
        "courses": courses,
        "active_batches": active_batches,
        "pending_enrollments": pending_enrollments,
        "revenue_this_month": str(revenue_this_month),
        "certificates_issued": certificates_issued,
        "kpis": {
            "total_students": students,
            "active_batches": active_batches,
            "courses": courses,
            "revenue": str(revenue_this_month),
        },
    }


def _teacher_dashboard(user) -> dict:
    scope = teacher_scope_filters(user)
    teacher = scope.get("teacher") if scope else None
    if teacher is None:
        return {
            "role": "teacher",
            "my_courses": 0,
            "my_batches": 0,
            "ongoing_batches": 0,
            "my_students": 0,
            "pending_reviews": 0,
            "open_portals": 0,
            "avg_progress": 0,
            "active_learners": 0,
            "kpis": {
                "my_courses": 0,
                "my_batches": 0,
                "my_students": 0,
                "pending_reviews": 0,
            },
            "batches": [],
            "assignments": [],
            "students_preview": [],
        }

    Batch = _get_model("batches.Batch")
    BatchStudent = _get_model("batches.BatchStudent")
    CourseInstructor = _get_model("courses.CourseInstructor")
    Assignment = _get_model("assignments.Assignment")
    Submission = _get_model("assignments.Submission")
    CourseProgress = _get_model("content.CourseProgress")

    my_courses = 0
    my_batches = 0
    ongoing_batches = 0
    my_students = 0
    pending_reviews = 0
    open_portals = 0
    batches_preview = []
    assignments_preview = []
    students_preview = []
    avg_progress = 0
    active_learners = 0

    try:
        if CourseInstructor:
            my_courses = CourseInstructor.objects.filter(
                teacher=teacher, is_deleted=False
            ).count() if hasattr(CourseInstructor, "is_deleted") else CourseInstructor.objects.filter(teacher=teacher).count()

        if Batch:
            bqs = Batch.objects.filter(teacher=teacher)
            if hasattr(Batch, "is_deleted"):
                bqs = bqs.filter(is_deleted=False)
            my_batches = bqs.count()
            ongoing_batches = bqs.filter(status="ONGOING").count()
            for b in bqs.select_related("course")[:10]:
                batches_preview.append(
                    {
                        "id": str(b.pk),
                        "code": getattr(b, "code", None) or str(b.pk),
                        "course": getattr(getattr(b, "course", None), "title", ""),
                        "start": str(getattr(b, "start_date", "") or getattr(b, "start", "")),
                        "status": getattr(b, "status", ""),
                    }
                )

        if BatchStudent:
            bs = BatchStudent.objects.filter(batch__teacher=teacher)
            if hasattr(BatchStudent, "is_deleted"):
                bs = bs.filter(is_deleted=False)
            my_students = bs.values("student").distinct().count()
            active_learners = bs.filter(
                Q(student__status="ACTIVE") | Q(is_active=True)
            ).values("student").distinct().count() if hasattr(BatchStudent, "is_active") else my_students

            for row in bs.select_related("student", "student__user", "batch")[:6]:
                student = row.student
                name = ""
                if getattr(student, "user", None):
                    name = student.user.get_full_name() or student.user.email
                students_preview.append(
                    {
                        "id": getattr(student, "student_id", None) or str(student.pk),
                        "name": name or str(student),
                        "batch": getattr(row.batch, "code", None) or str(row.batch_id),
                        "progress": 0,
                        "status": getattr(student, "status", "ACTIVE"),
                    }
                )

        if Assignment:
            aqs = Assignment.objects.filter(teacher=teacher)
            if hasattr(Assignment, "is_deleted"):
                aqs = aqs.filter(is_deleted=False)
            pending_reviews = aqs.filter(status__in=["PUBLISHED", "DRAFT"]).count()
            # Prefer submissions awaiting grade when available
            if Submission:
                try:
                    pending_reviews = Submission.objects.filter(
                        assignment__teacher=teacher,
                        status__in=["SUBMITTED", "PENDING"],
                    ).count()
                except Exception:
                    pass
            open_portals = aqs.filter(status="PUBLISHED").count()
            for a in aqs.select_related("course", "batch")[:5]:
                sub_count = 0
                if Submission:
                    try:
                        sub_count = Submission.objects.filter(assignment=a).count()
                    except Exception:
                        sub_count = 0
                assignments_preview.append(
                    {
                        "title": a.title,
                        "due": str(getattr(a, "due_date", "") or ""),
                        "submissions": sub_count,
                        "total": getattr(a, "max_attempts", None) or 0,
                        "status": a.status,
                        "portal_open": a.status == "PUBLISHED",
                    }
                )

        if CourseProgress and BatchStudent:
            try:
                student_ids = (
                    BatchStudent.objects.filter(batch__teacher=teacher)
                    .values_list("student_id", flat=True)
                    .distinct()
                )
                prog = CourseProgress.objects.filter(student_id__in=student_ids)
                vals = list(prog.values_list("percent_complete", flat=True)[:500])
                if vals:
                    avg_progress = round(sum(float(v or 0) for v in vals) / len(vals))
            except Exception:
                avg_progress = 0
    except Exception:
        logger.exception("Teacher dashboard failed")

    return {
        "role": "teacher",
        "my_courses": my_courses,
        "my_batches": my_batches,
        "ongoing_batches": ongoing_batches,
        "my_students": my_students,
        "pending_reviews": pending_reviews,
        "open_portals": open_portals,
        "avg_progress": avg_progress,
        "active_learners": active_learners,
        "kpis": {
            "my_courses": my_courses,
            "my_batches": my_batches,
            "my_students": my_students,
            "pending_reviews": pending_reviews,
        },
        "batches": batches_preview,
        "assignments": assignments_preview,
        "students_preview": students_preview,
        # Compat flat keys used by older admin widgets
        "students": my_students,
        "teachers": 1,
        "courses": my_courses,
        "active_batches": ongoing_batches,
        "pending_enrollments": 0,
        "revenue_this_month": "0.00",
        "certificates_issued": 0,
    }


def _student_dashboard(user) -> dict:
    Student = _get_model("students.Student")
    Enrollment = _get_model("enrollments.Enrollment")
    Assignment = _get_model("assignments.Assignment")
    AssignmentAllocation = _get_model("assignments.AssignmentAllocation")
    Certificate = _get_model("certificates.Certificate")
    StudentFee = _get_model("fees.StudentFee")
    BoardTask = _get_model("tasks.BoardTask")
    CourseProgress = _get_model("content.CourseProgress")

    student = None
    if Student:
        try:
            student = Student.objects.filter(user=user).first()
        except Exception:
            student = None

    my_courses = 0
    open_assignments = 0
    active_tasks = 0
    certificates = 0
    progress = 0
    fees = {"total": "0.00", "paid": "0.00", "due": "0.00", "status": "Paid"}
    course_title = ""
    batch_code = ""
    assignments_preview = []
    tasks_preview = []

    if student is None:
        return {
            "role": "student",
            "my_courses": 0,
            "open_assignments": 0,
            "active_tasks": 0,
            "certificates": 0,
            "progress": 0,
            "fees": fees,
            "kpis": {
                "my_courses": 0,
                "open_assignments": 0,
                "active_tasks": 0,
                "certificates": 0,
            },
            "assignments": [],
            "tasks": [],
            "course_title": "",
            "batch": "",
        }

    try:
        if Enrollment:
            enr = Enrollment.objects.filter(
                student=student,
                status__in=["ACTIVE", "APPROVED", "COMPLETED"],
            )
            # Paid / active enrollments ≈ frontend "paid courses"
            my_courses = enr.values("course").distinct().count()
            first = enr.select_related("course", "batch").first()
            if first:
                course_title = getattr(getattr(first, "course", None), "title", "")
                batch_code = getattr(getattr(first, "batch", None), "code", "") or ""

        if Assignment:
            aqs = Assignment.objects.filter(status="PUBLISHED")
            aqs = aqs.filter(
                Q(batch__batch_students__student=student)
                | Q(allocations__student=student)
                | Q(course__enrollments__student=student)
            ).distinct()
            open_assignments = aqs.count()
            for a in aqs.select_related("course", "batch")[:4]:
                assignments_preview.append(
                    {
                        "title": a.title,
                        "due": str(getattr(a, "due_date", "") or ""),
                        "portal_open": a.status == "PUBLISHED",
                    }
                )

        if BoardTask:
            try:
                tqs = BoardTask.objects.filter(student=student)
                active_tasks = tqs.filter(
                    status__in=["TO_DO", "IN_PROGRESS", "To Do", "In Progress"]
                ).count()
                for t in tqs.order_by("-updated_at")[:5]:
                    tasks_preview.append(
                        {
                            "id": str(t.pk),
                            "title": t.title,
                            "due": str(getattr(t, "due", "") or ""),
                            "status": t.status,
                        }
                    )
            except Exception:
                active_tasks = 0

        if Certificate:
            try:
                certificates = Certificate.objects.filter(student=student).count()
                if hasattr(Certificate, "is_deleted"):
                    certificates = Certificate.objects.filter(
                        student=student, is_deleted=False
                    ).count()
            except Exception:
                certificates = 0

        if CourseProgress:
            try:
                prog = CourseProgress.objects.filter(student=student).first()
                if prog:
                    progress = int(getattr(prog, "percent_complete", 0) or 0)
            except Exception:
                progress = 0

        if StudentFee:
            try:
                fee = StudentFee.objects.filter(student=student).first()
                if fee:
                    total = getattr(fee, "total_amount", None) or getattr(fee, "amount", 0) or 0
                    paid = getattr(fee, "paid_amount", None) or getattr(fee, "amount_paid", 0) or 0
                    due = getattr(fee, "due_amount", None)
                    if due is None:
                        due = Decimal(str(total)) - Decimal(str(paid))
                    total_d, paid_d, due_d = Decimal(str(total)), Decimal(str(paid)), Decimal(str(due))
                    if due_d <= 0:
                        status = "Paid"
                    elif paid_d <= 0:
                        status = "Pending"
                    else:
                        status = "Partially overdue"
                    fees = {
                        "total": str(total_d),
                        "paid": str(paid_d),
                        "due": str(due_d),
                        "status": status,
                    }
            except Exception:
                pass
    except Exception:
        logger.exception("Student dashboard failed")

    return {
        "role": "student",
        "my_courses": my_courses,
        "open_assignments": open_assignments,
        "active_tasks": active_tasks,
        "certificates": certificates,
        "progress": progress,
        "fees": fees,
        "course_title": course_title,
        "batch": batch_code,
        "kpis": {
            "my_courses": my_courses,
            "open_assignments": open_assignments,
            "active_tasks": active_tasks,
            "certificates": certificates,
        },
        "assignments": assignments_preview,
        "tasks": tasks_preview,
        "students": 0,
        "teachers": 0,
        "courses": my_courses,
        "active_batches": 1 if batch_code else 0,
        "pending_enrollments": 0,
        "revenue_this_month": "0.00",
        "certificates_issued": certificates,
    }


def dashboard_stats(user=None) -> dict:
    """
    Role-aware dashboard payload (mirrors frontend Admin / Teacher / Student overviews).
    """
    role = _resolve_role(user)
    if role == "teacher":
        data = _teacher_dashboard(user)
    elif role == "student":
        data = _student_dashboard(user)
    else:
        data = _admin_dashboard()

    data["generated_at"] = timezone.now().isoformat()
    return data


def admin_dashboard_summary() -> dict:
    """Dedicated admin overview API for summary cards."""
    data = _admin_dashboard()
    Invoice = _get_model("fees.Invoice")
    invoice_count = 0
    if Invoice:
        try:
            qs = Invoice.objects.all()
            if hasattr(Invoice, "is_deleted"):
                qs = qs.filter(is_deleted=False)
            invoice_count = qs.count()
        except Exception:
            invoice_count = 0
    data["invoices_issued"] = invoice_count
    data["kpis"]["invoices_issued"] = invoice_count
    data["generated_at"] = timezone.now().isoformat()
    data["source"] = "admin_summary"
    return data


def teacher_dashboard_summary(user) -> dict:
    """Dedicated teacher overview API for summary cards."""
    data = _teacher_dashboard(user)
    data["generated_at"] = timezone.now().isoformat()
    data["source"] = "teacher_summary"
    return data


def student_dashboard_summary(user) -> dict:
    """Dedicated student overview API for summary cards."""
    data = _student_dashboard(user)
    data["generated_at"] = timezone.now().isoformat()
    data["source"] = "student_summary"
    return data


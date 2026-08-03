"""Domain event helpers — call from other apps or signals."""

from __future__ import annotations

import logging

from apps.notifications.models import Notification
from apps.notifications.services.notification import NotificationService

logger = logging.getLogger(__name__)


def notify_enrollment_approved(enrollment) -> Notification | None:
    try:
        student = getattr(enrollment, "student", None)
        user = getattr(student, "user", None) if student else None
        course = getattr(enrollment, "course", None)
        course_title = getattr(course, "title", None) or getattr(course, "name", "your course")
        return NotificationService.create(
            user,
            title="Enrollment approved",
            message=f"Your enrollment for {course_title} has been approved.",
            notification_type=Notification.NotificationType.ENROLLMENT,
            event_code="ENROLLMENT_APPROVED",
            priority=Notification.Priority.HIGH,
            action_url=f"/enrollments/{enrollment.pk}",
            related_object_type="enrollment",
            related_object_id=enrollment.pk,
            metadata={
                "enrollment_number": getattr(enrollment, "enrollment_number", ""),
                "status": getattr(enrollment, "status", ""),
            },
            channels=[Notification.Channel.EMAIL],
        )
    except Exception:
        logger.exception("notify_enrollment_approved failed")
        return None


def _resolve_assignment_recipients(assignment) -> list:
    users = []
    seen = set()

    def _add_student(student):
        user = getattr(student, "user", None)
        if user is None:
            return
        pk = getattr(user, "pk", None)
        if pk in seen:
            return
        seen.add(pk)
        users.append(user)

    try:
        from apps.assignments.models import AssignmentAllocation

        for alloc in AssignmentAllocation.objects.filter(assignment=assignment).select_related(
            "student__user"
        ):
            if alloc.student_id:
                _add_student(alloc.student)
            if alloc.batch_id:
                try:
                    from apps.batches.models import BatchStudent

                    for bs in BatchStudent.objects.filter(batch_id=alloc.batch_id).select_related(
                        "student__user"
                    ):
                        _add_student(bs.student)
                except Exception:
                    pass
    except Exception:
        pass

    batch = getattr(assignment, "batch", None)
    if batch is not None:
        try:
            from apps.batches.models import BatchStudent

            for bs in BatchStudent.objects.filter(batch=batch).select_related("student__user"):
                _add_student(bs.student)
        except Exception:
            pass

    return users


def notify_assignment_created(assignment, recipients=None) -> list[Notification]:
    try:
        title = f"New assignment: {getattr(assignment, 'title', 'Assignment')}"
        due = getattr(assignment, "due_date", None)
        due_str = due.isoformat() if due else "TBD"
        message = f"A new assignment has been assigned. Due: {due_str}."
        users = list(recipients) if recipients is not None else _resolve_assignment_recipients(assignment)
        return NotificationService.notify_many(
            users,
            title=title,
            message=message,
            notification_type=Notification.NotificationType.ASSIGNMENT,
            event_code="ASSIGNMENT_CREATED",
            priority=Notification.Priority.MEDIUM,
            action_url=f"/assignments/{assignment.pk}",
            related_object_type="assignment",
            related_object_id=assignment.pk,
            metadata={"due_date": due_str},
        )
    except Exception:
        logger.exception("notify_assignment_created failed")
        return []


def notify_payment_received(payment) -> Notification | None:
    try:
        student_fee = getattr(payment, "student_fee", None)
        student = getattr(student_fee, "student", None) if student_fee else None
        user = getattr(student, "user", None) if student else None
        amount = getattr(payment, "amount", "")
        number = getattr(payment, "payment_number", "")
        return NotificationService.create(
            user,
            title="Payment received",
            message=f"We received your payment of {amount} (ref: {number}).",
            notification_type=Notification.NotificationType.PAYMENT,
            event_code="PAYMENT_RECEIVED",
            priority=Notification.Priority.HIGH,
            action_url=f"/fees/payments/{payment.pk}",
            related_object_type="payment",
            related_object_id=payment.pk,
            metadata={
                "amount": str(amount),
                "payment_number": number,
                "status": getattr(payment, "status", ""),
            },
            channels=[Notification.Channel.EMAIL],
        )
    except Exception:
        logger.exception("notify_payment_received failed")
        return None


def notify_certificate_issued(certificate) -> Notification | None:
    try:
        student = getattr(certificate, "student", None)
        user = getattr(student, "user", None) if student else getattr(certificate, "user", None)
        code = getattr(certificate, "certificate_number", None) or getattr(
            certificate, "code", str(getattr(certificate, "pk", ""))
        )
        return NotificationService.create(
            user,
            title="Certificate issued",
            message=f"Your certificate ({code}) has been issued. Congratulations!",
            notification_type=Notification.NotificationType.CERTIFICATE,
            event_code="CERTIFICATE_ISSUED",
            priority=Notification.Priority.HIGH,
            action_url=f"/certificates/{getattr(certificate, 'pk', '')}",
            related_object_type="certificate",
            related_object_id=getattr(certificate, "pk", ""),
            metadata={"certificate_number": code},
            channels=[Notification.Channel.EMAIL, Notification.Channel.BROWSER],
        )
    except Exception:
        logger.exception("notify_certificate_issued failed")
        return None


def notify_welcome(user) -> Notification | None:
    return NotificationService.create(
        user,
        title="Welcome to ShikshaLab",
        message="Your account is ready. Explore your dashboard to get started.",
        notification_type=Notification.NotificationType.AUTH,
        event_code="WELCOME",
        priority=Notification.Priority.MEDIUM,
        action_url="/dashboard",
        force=True,
        channels=[Notification.Channel.EMAIL],
    )


def notify_password_changed(user) -> Notification | None:
    return NotificationService.create(
        user,
        title="Password changed",
        message="Your ShikshaLab password was changed. If this wasn't you, contact support immediately.",
        notification_type=Notification.NotificationType.SECURITY,
        event_code="PASSWORD_CHANGED",
        priority=Notification.Priority.CRITICAL,
        action_url="/dashboard/settings",
        force=True,
        channels=[Notification.Channel.EMAIL, Notification.Channel.BROWSER],
    )


def ensure_inbox_seeded(user) -> list[Notification]:
    if Notification.objects.filter(recipient=user).exists():
        return []

    role = getattr(user, "role", "") or ""
    seeds: list[dict] = []
    if role == "TEACHER":
        seeds = [
            {
                "title": "Assignments pending review",
                "message": "Students submitted work in your open portals.",
                "notification_type": Notification.NotificationType.ASSIGNMENT,
                "action_url": "/dashboard/assignments",
            },
            {
                "title": "Upload course resources",
                "message": "Add notes or PDFs for this week’s chapters.",
                "notification_type": Notification.NotificationType.SYSTEM,
                "action_url": "/dashboard/resources",
            },
        ]
    elif role == "STUDENT":
        seeds = [
            {
                "title": "Assignment portal open",
                "message": "Submit your work before the due date.",
                "notification_type": Notification.NotificationType.ASSIGNMENT,
                "action_url": "/dashboard/assignments",
            },
            {
                "title": "Fee reminder",
                "message": "You have an overdue balance. Pay now to stay enrolled.",
                "notification_type": Notification.NotificationType.PAYMENT,
                "action_url": "/dashboard/fees",
            },
            {
                "title": "Certificate available",
                "message": "A certificate is ready to download.",
                "notification_type": Notification.NotificationType.CERTIFICATE,
                "action_url": "/dashboard/certificates",
            },
        ]
    else:
        seeds = [
            {
                "title": "Welcome to ShikshaLab",
                "message": "Your admin inbox is ready. Monitor enrollments and operations here.",
                "notification_type": Notification.NotificationType.SYSTEM,
                "action_url": "/dashboard",
            },
            {
                "title": "Assignments in review queue",
                "message": "Check submissions that need grading attention.",
                "notification_type": Notification.NotificationType.ASSIGNMENT,
                "action_url": "/dashboard/assignments",
            },
        ]

    created: list[Notification] = []
    for item in seeds:
        n = NotificationService.create(user, force=True, **item)
        if n is not None:
            created.append(n)
    return created

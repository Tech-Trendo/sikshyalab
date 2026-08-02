"""Celery periodic tasks for the fees module."""

from celery import shared_task
from django.utils import timezone


@shared_task(name="fees.mark_overdue_fees")
def mark_overdue_fees():
    """Mark unpaid fees past their due date as OVERDUE and notify stakeholders."""
    from apps.fees.models import FeeAuditLog, StudentFee

    today = timezone.now().date()
    overdue_qs = StudentFee.objects.filter(
        status__in=[StudentFee.Status.PENDING, StudentFee.Status.PARTIAL],
        due_date__lt=today,
    ).select_related("student", "student__user")

    count = 0
    for fee in overdue_qs:
        previous_status = fee.status
        fee.status = StudentFee.Status.OVERDUE
        fee.save(update_fields=["status", "updated_at"])

        FeeAuditLog.objects.create(
            action=FeeAuditLog.Action.STATUS,
            object_type="student_fee",
            object_id=str(fee.pk),
            previous_value={"status": previous_status},
            new_value={"status": StudentFee.Status.OVERDUE},
            detail=f"Auto-marked overdue (due_date={fee.due_date})",
        )

        try:
            from apps.notifications.services import notify_user, notify_users
            from django.contrib.auth import get_user_model

            student_user = getattr(getattr(fee, "student", None), "user", None)
            if student_user:
                notify_user(
                    student_user,
                    title="Your fee is overdue",
                    message=(
                        f"Your fee of {fee.due_amount} was due on {fee.due_date} "
                        f"and is now overdue. Please make a payment as soon as possible."
                    ),
                    notification_type="FEE",
                    event_code="FEE_OVERDUE",
                    priority="HIGH",
                    action_url="/dashboard/fees",
                    related_object_type="student_fee",
                    related_object_id=fee.pk,
                )

            User = get_user_model()
            admins = User.objects.filter(role="ADMIN", is_active=True)
            if admins.exists():
                notify_users(
                    admins,
                    title="A fee has become overdue",
                    message=(
                        f"Student fee #{fee.pk} (due {fee.due_date}, "
                        f"balance {fee.due_amount}) is now overdue."
                    ),
                    notification_type="FEE",
                    event_code="FEE_OVERDUE_ADMIN",
                    priority="MEDIUM",
                )
        except Exception:
            pass

        count += 1

    return f"Marked {count} fees as overdue."


@shared_task(name="fees.send_fee_reminders")
def send_fee_reminders():
    """Send reminder notifications for fees due in 3 days."""
    from apps.fees.models import StudentFee

    target_date = timezone.now().date() + timezone.timedelta(days=3)
    upcoming = StudentFee.objects.filter(
        status__in=[StudentFee.Status.PENDING, StudentFee.Status.PARTIAL],
        due_date=target_date,
    ).select_related("student", "student__user")

    count = 0
    for fee in upcoming:
        try:
            from apps.notifications.services import notify_user

            student_user = getattr(getattr(fee, "student", None), "user", None)
            if student_user:
                notify_user(
                    student_user,
                    title="Fee payment reminder",
                    message=(
                        f"Your fee of {fee.due_amount} is due on {fee.due_date}. "
                        f"Please make a payment before the due date to avoid penalties."
                    ),
                    notification_type="FEE",
                    event_code="FEE_REMINDER",
                    priority="MEDIUM",
                    action_url="/dashboard/fees",
                    related_object_type="student_fee",
                    related_object_id=fee.pk,
                )
                count += 1
        except Exception:
            pass

    return f"Sent {count} fee reminders."

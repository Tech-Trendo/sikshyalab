"""Admin provisioning: create users with hashed temp passwords + profiles."""

from __future__ import annotations

import secrets
import string

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts.emails import send_account_credentials_email
from apps.accounts.models import UserProfile, UserSettings
from apps.notifications.services import ensure_inbox_seeded, get_or_create_preferences

User = get_user_model()


def generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    # Ensure mix of classes for validators that require variety
    chars = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%&*"),
    ]
    chars += [secrets.choice(alphabet) for _ in range(max(0, length - len(chars)))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def _next_code(prefix: str, model, field: str) -> str:
    # Include soft-deleted rows so codes stay unique across restores
    manager = getattr(model, "all_objects", model.objects)
    count = manager.count() + 1
    for _ in range(50):
        code = f"{prefix}-{count:04d}"
        if not manager.filter(**{field: code}).exists():
            return code
        count += 1
    return f"{prefix}-{secrets.token_hex(4).upper()}"


def _ensure_student_profile(user) -> None:
    from apps.students.models import Student

    existing = Student.all_objects.filter(user=user).first()
    if existing:
        if existing.is_deleted:
            existing.restore()
        # Do NOT auto-reactivate INACTIVE students here — admin deactivation
        # must persist until an explicit reactivate/provision decision.
        return

    Student.objects.create(
        user=user,
        student_id=_next_code("STU", Student, "student_id"),
        status=Student.Status.ACTIVE,
    )


def _ensure_teacher_profile(user) -> None:
    from apps.teachers.models import Teacher

    existing = Teacher.all_objects.filter(user=user).first()
    if existing:
        if existing.is_deleted:
            existing.restore()
        if existing.status == Teacher.Status.INACTIVE:
            existing.status = Teacher.Status.ACTIVE
            existing.save(update_fields=["status", "updated_at"])
        return

    Teacher.objects.create(
        user=user,
        teacher_id=_next_code("TCH", Teacher, "teacher_id"),
        status=Teacher.Status.ACTIVE,
    )


def _ensure_role_profile(user, role: str) -> None:
    if role == User.Role.STUDENT:
        _ensure_student_profile(user)
    elif role == User.Role.TEACHER:
        _ensure_teacher_profile(user)


def _active_role_profile_exists(user, role: str) -> bool:
    if role == User.Role.STUDENT:
        from apps.students.models import Student

        return Student.objects.filter(user=user).exists()
    if role == User.Role.TEACHER:
        from apps.teachers.models import Teacher

        return Teacher.objects.filter(user=user).exists()
    return False


def _get_student_profile(user):
    from apps.students.models import Student

    return Student.objects.filter(user=user).first()


def enroll_provisioned_student(
    *,
    student,
    course,
    batch=None,
    changed_by=None,
):
    """
    Create an ACTIVE enrollment for a newly provisioned student.
    Optionally adds batch membership when a batch is provided.
    """
    from decimal import Decimal

    from django.utils import timezone

    from apps.batches.services import add_student_to_batch
    from apps.enrollments.models import Enrollment
    from apps.enrollments.services import generate_enrollment_number, record_status_change

    existing = Enrollment.objects.filter(
        student=student,
        course=course,
        status__in=[
            Enrollment.Status.PENDING,
            Enrollment.Status.APPROVED,
            Enrollment.Status.ACTIVE,
            Enrollment.Status.SUSPENDED,
        ],
    ).first()
    if existing:
        if batch and existing.batch_id != batch.pk:
            existing.batch = batch
            existing.shift = getattr(batch, "shift", None)
            existing.save(update_fields=["batch", "shift", "updated_at"])
            if existing.status == Enrollment.Status.ACTIVE:
                add_student_to_batch(
                    batch=batch,
                    student=student,
                    notes=f"Enrollment {existing.enrollment_number}",
                )
        return existing

    price = course.discount_price if course.discount_price not in (None, "") else course.price
    amount = Decimal(str(price or 0))
    enrollment_type = getattr(course, "enrollment_type", None) or Enrollment.EnrollmentType.PHYSICAL
    now = timezone.now()

    enrollment = Enrollment.objects.create(
        student=student,
        course=course,
        batch=batch,
        shift=getattr(batch, "shift", None) if batch else None,
        enrollment_type=enrollment_type,
        status=Enrollment.Status.ACTIVE,
        amount=amount,
        discount_amount=Decimal("0.00"),
        final_amount=amount,
        enrollment_number=generate_enrollment_number(),
        approved_by=changed_by,
        approved_at=now,
        enrolled_at=now,
        notes="Created with student account",
    )
    record_status_change(
        enrollment,
        from_status="",
        to_status=Enrollment.Status.ACTIVE,
        changed_by=changed_by,
        remark="Provisioned with student account",
    )
    if batch is not None:
        add_student_to_batch(
            batch=batch,
            student=student,
            notes=f"Enrollment {enrollment.enrollment_number}",
        )
    try:
        from apps.fees.services import ensure_student_fee_for_enrollment

        ensure_student_fee_for_enrollment(enrollment, reset_paid=True)
    except Exception:
        # Fee creation must not block student provisioning.
        pass
    return enrollment


@transaction.atomic
def provision_user(
    *,
    email: str,
    role: str,
    first_name: str = "",
    last_name: str = "",
    phone: str | None = None,
    create_role_profile: bool = True,
    send_email: bool = True,
    course=None,
    batch=None,
    changed_by=None,
) -> tuple[User, str, bool, str, object | None]:
    """
    Create a user with a random temporary password (hashed via set_password).

    If the email already belongs to a user with the same role:
    - restore soft-deleted student/teacher profiles when missing
    - create a missing role profile (orphan account after demo wipe)
    - rotate a temporary password and optionally re-email credentials

    When role is STUDENT and course is provided, creates an ACTIVE enrollment.

    Returns (user, temporary_password, email_sent, email_error, enrollment).
    """
    email = email.lower().strip()
    role = (role or User.Role.STUDENT).upper()
    if role not in (User.Role.ADMIN, User.Role.TEACHER, User.Role.STUDENT):
        raise ValueError("Invalid role. Use ADMIN, TEACHER, or STUDENT.")

    enrollment = None
    existing = User.objects.filter(email__iexact=email).first()
    if existing:
        existing_role = (existing.role or "").upper()
        if existing_role and existing_role != role:
            raise ValueError(
                f"A user with this email already exists as {existing_role}. "
                f"Cannot provision as {role}."
            )
        if (
            create_role_profile
            and role in (User.Role.STUDENT, User.Role.TEACHER)
            and _active_role_profile_exists(existing, role)
        ):
            raise ValueError("A user with this email already exists.")

        # Reuse orphan / soft-deleted account for the same role
        user = existing
        updates: list[str] = []
        if first_name and user.first_name != first_name.strip():
            user.first_name = first_name.strip()
            updates.append("first_name")
        if last_name is not None and user.last_name != (last_name or "").strip():
            user.last_name = (last_name or "").strip()
            updates.append("last_name")
        if phone and user.phone != phone:
            conflict = User.objects.filter(phone=phone).exclude(pk=user.pk).exists()
            if conflict:
                raise ValueError("A user with this phone already exists.")
            user.phone = phone
            updates.append("phone")
        if not user.is_active:
            user.is_active = True
            updates.append("is_active")
        if not user.is_active_account:
            user.is_active_account = True
            updates.append("is_active_account")
        if (user.role or "").upper() != role:
            user.role = role
            updates.append("role")

        temporary_password = generate_temporary_password()
        user.set_password(temporary_password)
        user.must_change_password = True
        user.provisional_password = temporary_password
        updates.extend(["password", "must_change_password", "provisional_password", "updated_at"])
        user.save(update_fields=list(dict.fromkeys(updates)))

        UserProfile.objects.get_or_create(user=user)
        UserSettings.objects.get_or_create(user=user)
        get_or_create_preferences(user)
        ensure_inbox_seeded(user)

        if create_role_profile:
            _ensure_role_profile(user, role)

        if role == User.Role.STUDENT and course is not None:
            student = _get_student_profile(user)
            if student is not None:
                enrollment = enroll_provisioned_student(
                    student=student,
                    course=course,
                    batch=batch,
                    changed_by=changed_by,
                )

        email_sent = False
        email_error = ""
        if send_email:
            email_sent, email_error = send_account_credentials_email(
                email=user.email,
                temporary_password=temporary_password,
                role=role,
                name=user.get_full_name(),
            )
        return user, temporary_password, email_sent, email_error, enrollment

    temporary_password = generate_temporary_password()
    user = User(
        email=email,
        first_name=(first_name or "").strip(),
        last_name=(last_name or "").strip(),
        phone=phone or None,
        role=role,
        is_active=True,
        is_active_account=True,
        is_email_verified=False,
        must_change_password=True,
        provisional_password=temporary_password,
        is_staff=role == User.Role.ADMIN,
        is_superuser=False,
    )
    user.set_password(temporary_password)
    user.save()

    UserProfile.objects.get_or_create(user=user)
    UserSettings.objects.get_or_create(user=user)
    get_or_create_preferences(user)
    ensure_inbox_seeded(user)

    if create_role_profile:
        _ensure_role_profile(user, role)

    if role == User.Role.STUDENT and course is not None:
        student = _get_student_profile(user)
        if student is not None:
            enrollment = enroll_provisioned_student(
                student=student,
                course=course,
                batch=batch,
                changed_by=changed_by,
            )

    email_sent = False
    email_error = ""
    if send_email:
        email_sent, email_error = send_account_credentials_email(
            email=user.email,
            temporary_password=temporary_password,
            role=role,
            name=user.get_full_name(),
        )

    return user, temporary_password, email_sent, email_error, enrollment

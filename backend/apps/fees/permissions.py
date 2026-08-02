"""Fee-module permission classes."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, user_has_role


def _get_student_for_user(user):
    student = getattr(user, "student", None)
    if student is not None:
        return student
    try:
        from apps.students.models import Student

        return Student.objects.filter(user=user).first()
    except Exception:
        return None


class IsAdminOrFinanceStaff(BasePermission):
    """Full financial write access for admins/staff."""

    message = "Admin or finance staff privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)


class IsAdminOrOwnStudentFeeRead(BasePermission):
    """
    Admins: full access.
    Students: read-only on their own fees / invoices / payments.
    """

    message = "You may only view your own fee records."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(request.user, ROLE_STUDENT):
            return request.method in SAFE_METHODS
        return False

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if request.method not in SAFE_METHODS:
            return False

        student = _get_student_for_user(request.user)
        if student is None:
            return False

        if hasattr(obj, "student_id"):
            return obj.student_id == student.pk
        if hasattr(obj, "student_fee"):
            return obj.student_fee.student_id == student.pk
        if hasattr(obj, "payment"):
            return obj.payment.student_fee.student_id == student.pk
        return False

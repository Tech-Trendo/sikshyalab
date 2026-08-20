"""Assignment-module permission helpers."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_STUDENT,
    ROLE_TEACHER,
    user_has_role,
)


def get_student_for_user(user):
    student = getattr(user, "student", None) or getattr(user, "student_profile", None)
    if student is not None:
        return student
    try:
        from apps.students.models import Student

        return Student.objects.filter(user=user).first()
    except Exception:
        return None


def get_teacher_for_user(user):
    teacher = getattr(user, "teacher", None) or getattr(user, "teacher_profile", None)
    if teacher is not None:
        return teacher
    try:
        from apps.teachers.models import Teacher

        return Teacher.objects.filter(user=user).first()
    except Exception:
        return None


def teacher_manages_assignment(teacher, assignment) -> bool:
    """True when the teacher owns the assignment or instructs its course."""
    if teacher is None or assignment is None:
        return False
    if getattr(assignment, "teacher_id", None) == teacher.pk:
        return True
    course_id = getattr(assignment, "course_id", None)
    if not course_id:
        return False
    from apps.courses.models import CourseInstructor

    return CourseInstructor.objects.filter(course_id=course_id, teacher=teacher).exists()


def teacher_assignment_q(teacher):
    """Q() matching assignments this teacher can manage."""
    from django.db.models import Q

    from apps.courses.models import CourseInstructor

    course_ids = CourseInstructor.objects.filter(teacher=teacher).values("course_id")
    return Q(teacher=teacher) | Q(course_id__in=course_ids)


def user_can_access_assignment_media(user, relpath: str) -> bool:
    """Object-level gate for ``assignments/`` media keys."""
    from apps.assignments.models import Assignment, AssignmentResource, Submission

    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        return True

    teacher = get_teacher_for_user(user)
    student = get_student_for_user(user)

    if relpath.startswith("assignments/submissions/"):
        submission = (
            Submission.objects.filter(attachment=relpath)
            .select_related("assignment", "student")
            .first()
        )
        if submission is None:
            return False
        if student and submission.student_id == student.pk:
            return True
        if teacher and teacher_manages_assignment(teacher, submission.assignment):
            return True
        return False

    assignment = Assignment.objects.filter(attachment=relpath).first()
    if assignment is None:
        resource = (
            AssignmentResource.objects.filter(file=relpath)
            .select_related("assignment")
            .first()
        )
        assignment = resource.assignment if resource else None
    if assignment is None:
        return False
    if teacher and teacher_manages_assignment(teacher, assignment):
        return True
    if student:
        from apps.assignments.views import student_is_allocated

        if student_is_allocated(assignment, student):
            return True
        if assignment.status == assignment.Status.PUBLISHED and not assignment.allocations.exists():
            return True
    return False


class IsAssignmentAdminOrTeacher(BasePermission):
    """Admins and teachers can manage assignments."""

    message = "Teacher or admin privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER)


class IsAssignmentParticipant(BasePermission):
    """
    Admin: all.
    Teacher: manage own course assignments / grade.
    Student: read allocated + submit.
    """

    message = "You do not have access to this assignment resource."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER):
            return True
        if user_has_role(request.user, ROLE_STUDENT):
            write_actions = {"create", "update", "partial_update", "destroy"}
            if getattr(view, "action", None) in write_actions and view.__class__.__name__ not in (
                "SubmissionViewSet",
            ):
                return False
            return True
        return False

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True

        teacher = get_teacher_for_user(request.user)
        student = get_student_for_user(request.user)

        assignment = getattr(obj, "assignment", obj)
        if teacher and hasattr(assignment, "teacher_id") and teacher_manages_assignment(
            teacher, assignment
        ):
            return True

        if student is None:
            return request.method in SAFE_METHODS and teacher is not None

        # Student ownership checks
        if hasattr(obj, "student_id"):
            return obj.student_id == student.pk
        if hasattr(obj, "submission"):
            return obj.submission.student_id == student.pk
        if hasattr(obj, "allocations"):
            return True  # filtered in queryset
        return request.method in SAFE_METHODS

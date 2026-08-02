"""
Notification event catalog and channel identifiers.

Event codes are stable string keys used by templates, analytics, and
automatic notification emitters. Categories map to Notification.notification_type.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Channels (extensible — SMS / PUSH can be registered later)
# ---------------------------------------------------------------------------
CHANNEL_IN_APP = "IN_APP"
CHANNEL_EMAIL = "EMAIL"
CHANNEL_BROWSER = "BROWSER"
CHANNEL_SMS = "SMS"
CHANNEL_PUSH = "PUSH"

SUPPORTED_CHANNELS = (
    CHANNEL_IN_APP,
    CHANNEL_EMAIL,
    CHANNEL_BROWSER,
    CHANNEL_SMS,
    CHANNEL_PUSH,
)

# ---------------------------------------------------------------------------
# Categories (coarse types stored on Notification.notification_type)
# ---------------------------------------------------------------------------
CATEGORY_AUTH = "AUTH"
CATEGORY_STUDENT = "STUDENT"
CATEGORY_COURSE = "COURSE"
CATEGORY_BATCH = "BATCH"
CATEGORY_ASSIGNMENT = "ASSIGNMENT"
CATEGORY_ATTENDANCE = "ATTENDANCE"
CATEGORY_EXAM = "EXAM"
CATEGORY_CERTIFICATE = "CERTIFICATE"
CATEGORY_SECURITY = "SECURITY"
CATEGORY_ENROLLMENT = "ENROLLMENT"
CATEGORY_PAYMENT = "PAYMENT"
CATEGORY_ANNOUNCEMENT = "ANNOUNCEMENT"
CATEGORY_SYSTEM = "SYSTEM"
CATEGORY_ADMIN = "ADMIN"

# ---------------------------------------------------------------------------
# Event codes (fine-grained)
# ---------------------------------------------------------------------------
EVENTS = {
    # Authentication
    "WELCOME": CATEGORY_AUTH,
    "OTP": CATEGORY_AUTH,
    "PASSWORD_RESET": CATEGORY_AUTH,
    "PASSWORD_CHANGED": CATEGORY_SECURITY,
    "LOGIN_NEW_DEVICE": CATEGORY_SECURITY,
    "ACCOUNT_ACTIVATED": CATEGORY_AUTH,
    "FAILED_LOGIN": CATEGORY_SECURITY,
    "ACCOUNT_LOCKED": CATEGORY_SECURITY,
    # Student management
    "REGISTRATION_SUBMITTED": CATEGORY_STUDENT,
    "REGISTRATION_APPROVED": CATEGORY_STUDENT,
    "REGISTRATION_REJECTED": CATEGORY_STUDENT,
    "PROFILE_UPDATED": CATEGORY_STUDENT,
    "ACCOUNT_SUSPENDED": CATEGORY_STUDENT,
    # Course
    "COURSE_PUBLISHED": CATEGORY_COURSE,
    "COURSE_UPDATED": CATEGORY_COURSE,
    "CHAPTER_ADDED": CATEGORY_COURSE,
    "VIDEO_UPLOADED": CATEGORY_COURSE,
    "MATERIAL_ADDED": CATEGORY_COURSE,
    # Batch
    "BATCH_ASSIGNED": CATEGORY_BATCH,
    "BATCH_CHANGED": CATEGORY_BATCH,
    "SHIFT_CHANGED": CATEGORY_BATCH,
    "SCHEDULE_UPDATED": CATEGORY_BATCH,
    "BATCH_COMPLETED": CATEGORY_BATCH,
    # Assignments
    "ASSIGNMENT_CREATED": CATEGORY_ASSIGNMENT,
    "ASSIGNMENT_REMINDER": CATEGORY_ASSIGNMENT,
    "ASSIGNMENT_DEADLINE": CATEGORY_ASSIGNMENT,
    "ASSIGNMENT_SUBMITTED": CATEGORY_ASSIGNMENT,
    "ASSIGNMENT_GRADED": CATEGORY_ASSIGNMENT,
    "ASSIGNMENT_FEEDBACK": CATEGORY_ASSIGNMENT,
    # Attendance
    "ATTENDANCE_MARKED": CATEGORY_ATTENDANCE,
    "STUDENT_ABSENT": CATEGORY_ATTENDANCE,
    "LOW_ATTENDANCE": CATEGORY_ATTENDANCE,
    # Exams
    "EXAM_SCHEDULED": CATEGORY_EXAM,
    "EXAM_REMINDER": CATEGORY_EXAM,
    "RESULT_PUBLISHED": CATEGORY_EXAM,
    # Certificates
    "CERTIFICATE_GENERATED": CATEGORY_CERTIFICATE,
    "CERTIFICATE_READY": CATEGORY_CERTIFICATE,
    "CERTIFICATE_VERIFIED": CATEGORY_CERTIFICATE,
    # Legacy / domain
    "ENROLLMENT_APPROVED": CATEGORY_ENROLLMENT,
    "PAYMENT_RECEIVED": CATEGORY_PAYMENT,
    "CERTIFICATE_ISSUED": CATEGORY_CERTIFICATE,
}


def category_for_event(event_code: str) -> str:
    return EVENTS.get((event_code or "").upper(), CATEGORY_SYSTEM)

#!/usr/bin/env python
"""
Remove demo / seed content from the database (site + dashboard data).

Keeps: roles, non-demo user accounts, migrations.
Deletes: CMS content, courses/catalog, students/teachers/batches, certificates,
         assignments, tasks, fees, enrollments, notifications,
         analytics reports, SEO pages, and @shikshalab.demo users.

Usage (from backend/, venv active):

    python scripts/clear_demo_data.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()


def _wipe(label: str, model) -> None:
    """Hard-delete all rows (including soft-deleted)."""
    manager = getattr(model, "all_objects", None) or model.objects
    qs = manager.all()
    try:
        result = qs.delete(hard=True)
    except TypeError:
        result = qs.delete()
    count = result[0] if isinstance(result, tuple) else result
    print(f"  {label}: deleted {count}")


@transaction.atomic
def main() -> None:
    print("Clearing ShikshaLab demo / seed data...")

    # Certificates
    try:
        from apps.certificates.models import Certificate

        _wipe("certificates", Certificate)
    except Exception as exc:
        print(f"  certificates: skip ({exc})")

    # Assignments
    try:
        from apps.assignments.models import (
            Assignment,
            AssignmentAllocation,
            AssignmentResource,
            Submission,
            SubmissionReview,
        )

        for label, model in (
            ("submission reviews", SubmissionReview),
            ("submissions", Submission),
            ("assignment allocations", AssignmentAllocation),
            ("assignment resources", AssignmentResource),
            ("assignments", Assignment),
        ):
            _wipe(label, model)
    except Exception as exc:
        print(f"  assignments: skip ({exc})")

    # Tasks
    try:
        from apps.tasks.models import BoardTask

        _wipe("board tasks", BoardTask)
    except Exception as exc:
        print(f"  tasks: skip ({exc})")

    # Fees
    try:
        from apps.fees.models import (
            Discount,
            FeeStructure,
            InstallmentPlan,
            InstallmentSchedule,
            Invoice,
            Payment,
            Receipt,
            Refund,
            Scholarship,
            StudentFee,
            StudentScholarship,
        )

        for label, model in (
            ("refunds", Refund),
            ("receipts", Receipt),
            ("payments", Payment),
            ("invoices", Invoice),
            ("student scholarships", StudentScholarship),
            ("scholarships", Scholarship),
            ("discounts", Discount),
            ("installment schedules", InstallmentSchedule),
            ("installment plans", InstallmentPlan),
            ("student fees", StudentFee),
            ("fee structures", FeeStructure),
        ):
            _wipe(label, model)
    except Exception as exc:
        print(f"  fees: skip ({exc})")

    # Enrollments
    try:
        from apps.enrollments.models import Enrollment

        _wipe("enrollments", Enrollment)
    except Exception as exc:
        print(f"  enrollments: skip ({exc})")

    # Batches
    try:
        from apps.batches.models import Batch, BatchSchedule, BatchStudent, Shift

        for label, model in (
            ("batch schedules", BatchSchedule),
            ("batch students", BatchStudent),
            ("batches", Batch),
            ("shifts", Shift),
        ):
            _wipe(label, model)
    except Exception as exc:
        print(f"  batches: skip ({exc})")

    # Course content
    try:
        from apps.content.models import (
            Chapter,
            ChapterProgress,
            CourseProgress,
            Part,
            PartAttachment,
            PartResource,
            StudentProgress,
        )

        for label, model in (
            ("student progress", StudentProgress),
            ("chapter progress", ChapterProgress),
            ("course progress", CourseProgress),
            ("part attachments", PartAttachment),
            ("part resources", PartResource),
            ("parts", Part),
            ("chapters", Chapter),
        ):
            _wipe(label, model)
    except Exception as exc:
        print(f"  content: skip ({exc})")

    # Courses
    try:
        from apps.courses.models import Course, CourseCategory, CourseInstructor

        _wipe("course instructors", CourseInstructor)
        _wipe("courses", Course)
        _wipe("course categories", CourseCategory)
    except Exception as exc:
        print(f"  courses: skip ({exc})")

    # Students / teachers
    try:
        from apps.students.models import Student

        _wipe("students", Student)
    except Exception as exc:
        print(f"  students: skip ({exc})")

    try:
        from apps.teachers.models import Teacher

        _wipe("teachers", Teacher)
    except Exception as exc:
        print(f"  teachers: skip ({exc})")

    # CMS
    try:
        from apps.cms.models import (
            Announcement,
            Banner,
            BlogPost,
            Career,
            CMSTeacherHighlight,
            ContactMessage,
            CourseReview,
            Event,
            EventRegistration,
            FAQ,
            GalleryItem,
            Page,
            Partner,
            SiteSetting,
            Testimonial,
        )

        for label, model in (
            ("event registrations", EventRegistration),
            ("events", Event),
            ("blog posts", BlogPost),
            ("gallery", GalleryItem),
            ("partners", Partner),
            ("testimonials", Testimonial),
            ("faqs", FAQ),
            ("careers", Career),
            ("banners", Banner),
            ("pages", Page),
            ("announcements", Announcement),
            ("contact messages", ContactMessage),
            ("course reviews", CourseReview),
            ("teacher highlights", CMSTeacherHighlight),
        ):
            _wipe(label, model)

        for setting in SiteSetting.all_objects.all():
            setting.features_eyebrow = ""
            setting.features_heading = ""
            setting.homepage_features = []
            setting.testimonials_eyebrow = ""
            setting.testimonials_heading = ""
            setting.tagline = ""
            setting.footer_text = ""
            setting.save(
                update_fields=[
                    "features_eyebrow",
                    "features_heading",
                    "homepage_features",
                    "testimonials_eyebrow",
                    "testimonials_heading",
                    "tagline",
                    "footer_text",
                ]
            )
        print(
            f"  site settings: cleared features / marketing fields "
            f"({SiteSetting.all_objects.count()} row(s))"
        )
    except Exception as exc:
        print(f"  cms: skip ({exc})")

    # SEO
    try:
        from apps.seo.models import RedirectRule, SEOMetadata, SitemapEntry

        _wipe("seo redirects", RedirectRule)
        _wipe("sitemap entries", SitemapEntry)
        _wipe("seo metadata", SEOMetadata)
    except Exception as exc:
        print(f"  seo: skip ({exc})")

    # Notifications / analytics
    try:
        from apps.notifications.models import Notification

        _wipe("notifications", Notification)
    except Exception as exc:
        print(f"  notifications: skip ({exc})")

    try:
        from apps.analytics.models import SavedReport

        _wipe("saved reports", SavedReport)
    except Exception as exc:
        print(f"  analytics: skip ({exc})")

    # Demo users only
    demo_qs = User.objects.filter(email__iendswith="@shikshalab.demo")
    n = demo_qs.count()
    demo_qs.delete()
    print(f"  demo users (@shikshalab.demo): deleted {n}")

    print("Done. Site and dashboard content should now be empty.")


if __name__ == "__main__":
    main()

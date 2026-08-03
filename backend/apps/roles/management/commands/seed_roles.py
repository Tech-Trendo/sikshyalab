"""
Seed default permissions, system roles, and feature flags for ShikshaLab.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.roles.models import FeatureFlag, Permission, Role

# CRUD-style actions applied to every module.
ACTIONS = (
    ("view", "View"),
    ("create", "Create"),
    ("update", "Update"),
    ("delete", "Delete"),
    ("export", "Export"),
)

MODULES = (
    ("accounts", "Accounts"),
    ("roles", "Roles & Permissions"),
    ("students", "Students"),
    ("teachers", "Teachers"),
    ("courses", "Courses"),
    ("content", "Course Content"),
    ("batches", "Batches"),
    ("enrollments", "Enrollments"),
    ("fees", "Fees"),
    ("assignments", "Assignments"),
    ("certificates", "Certificates"),
    ("cms", "CMS"),
    ("seo", "SEO"),
    ("notifications", "Notifications"),
    ("analytics", "Analytics"),
    ("common", "Common"),
)

# Extra module-specific permissions beyond CRUD.
EXTRA_PERMISSIONS = [
    # accounts
    ("accounts.manage_users", "Manage Users", "accounts", "Full user administration"),
    ("accounts.view_activity_logs", "View Activity Logs", "accounts", "View system activity logs"),
    ("accounts.verify_email", "Verify Email", "accounts", "Mark user emails as verified"),
    # roles
    ("roles.assign_roles", "Assign Roles", "roles", "Assign roles to users"),
    ("roles.manage_feature_flags", "Manage Feature Flags", "roles", "Toggle feature flags"),
    # students
    ("students.manage_guardians", "Manage Guardians", "students", "Manage student guardian info"),
    ("students.view_academic_history", "View Academic History", "students", "View student academic history"),
    # teachers
    ("teachers.assign_courses", "Assign Courses", "teachers", "Assign courses to teachers"),
    ("teachers.view_workload", "View Workload", "teachers", "View teacher workload"),
    # courses
    ("courses.publish", "Publish Courses", "courses", "Publish or unpublish courses"),
    ("courses.assign_instructors", "Assign Instructors", "courses", "Assign instructors to courses"),
    # content
    ("content.manage_chapters", "Manage Chapters", "content", "Manage course chapters and parts"),
    ("content.upload_resources", "Upload Resources", "content", "Upload learning resources"),
    ("content.track_progress", "Track Progress", "content", "View and update learning progress"),
    # batches
    ("batches.assign_teachers", "Assign Batch Teachers", "batches", "Assign teachers to batches"),
    ("batches.manage_shifts", "Manage Shifts", "batches", "Manage batch shifts and schedules"),
    # enrollments
    ("enrollments.approve", "Approve Enrollments", "enrollments", "Approve or reject enrollments"),
    ("enrollments.transfer", "Transfer Enrollments", "enrollments", "Transfer students between batches"),
    # fees
    ("fees.manage_invoices", "Manage Invoices", "fees", "Create and manage invoices"),
    ("fees.process_payments", "Process Payments", "fees", "Record and process payments"),
    ("fees.manage_refunds", "Manage Refunds", "fees", "Process fee refunds"),
    ("fees.apply_scholarships", "Apply Scholarships", "fees", "Apply scholarships and discounts"),
    # assignments
    ("assignments.grade", "Grade Assignments", "assignments", "Grade student submissions"),
    ("assignments.submit", "Submit Assignments", "assignments", "Submit assignment work"),
    # certificates
    ("certificates.generate", "Generate Certificates", "certificates", "Generate course certificates"),
    ("certificates.verify", "Verify Certificates", "certificates", "Verify certificate authenticity"),
    # cms
    ("cms.publish_content", "Publish CMS Content", "cms", "Publish website content"),
    ("cms.manage_banners", "Manage Banners", "cms", "Manage homepage banners"),
    # seo
    ("seo.manage_metadata", "Manage SEO Metadata", "seo", "Edit SEO metadata"),
    ("seo.manage_sitemaps", "Manage Sitemaps", "seo", "Manage sitemap configuration"),
    # notifications
    ("notifications.send", "Send Notifications", "notifications", "Send in-app notifications"),
    ("notifications.manage_templates", "Manage Notification Templates", "notifications", "Manage templates"),
    # analytics
    ("analytics.view_dashboard", "View Dashboard", "analytics", "View analytics dashboard"),
    ("analytics.view_revenue", "View Revenue Reports", "analytics", "View financial analytics"),
    # common
    ("common.manage_settings", "Manage Settings", "common", "Manage system settings"),
]

SYSTEM_ROLES = {
    "Admin": {
        "description": "Full system access for institute administrators.",
        "all_permissions": True,
    },
    "Teacher": {
        "description": "Manage assigned courses, batches, content, and assignments.",
        "permissions": [
            "accounts.view",
            "students.view",
            "teachers.view",
            "teachers.update",
            "courses.view",
            "content.view",
            "content.create",
            "content.update",
            "content.manage_chapters",
            "content.upload_resources",
            "content.track_progress",
            "batches.view",
            "enrollments.view",
            "fees.view",
            "assignments.view",
            "assignments.create",
            "assignments.update",
            "assignments.grade",
            "certificates.view",
            "notifications.view",
            "notifications.send",
            "analytics.view",
            "analytics.view_dashboard",
        ],
    },
    "Student": {
        "description": "Access enrolled courses, content, assignments, fees, and certificates.",
        "permissions": [
            "accounts.view",
            "accounts.update",
            "courses.view",
            "content.view",
            "content.track_progress",
            "batches.view",
            "enrollments.view",
            "enrollments.create",
            "fees.view",
            "assignments.view",
            "assignments.submit",
            "certificates.view",
            "certificates.verify",
            "notifications.view",
            "cms.view",
        ],
    },
}

DEFAULT_FEATURE_FLAGS = [
    (
        "Online Enrollment",
        "online_enrollment",
        True,
        "Allow students to enroll in online courses.",
    ),
    (
        "Certificate Auto Generation",
        "certificate_auto_generation",
        True,
        "Automatically generate certificates on course completion.",
    ),
    (
        "Payment Gateway",
        "payment_gateway",
        False,
        "Enable external payment gateway integration.",
    ),
    (
        "SMS Notifications",
        "sms_notifications",
        False,
        "Send notifications via SMS.",
    ),
    (
        "Email Notifications",
        "email_notifications",
        True,
        "Send notifications via email.",
    ),
    (
        "Public Certificate Verification",
        "public_certificate_verification",
        True,
        "Allow public verification of certificates by code.",
    ),
]


class Command(BaseCommand):
    help = "Seed default permissions, system roles, and feature flags for all modules."

    @transaction.atomic
    def handle(self, *args, **options):
        permission_map = self._seed_permissions()
        self._seed_roles(permission_map)
        self._seed_feature_flags()
        self.stdout.write(self.style.SUCCESS("Successfully seeded roles and permissions."))

    def _seed_permissions(self):
        permission_map = {}
        created_count = 0
        updated_count = 0

        for module_code, module_label in MODULES:
            for action_code, action_label in ACTIONS:
                codename = f"{module_code}.{action_code}"
                defaults = {
                    "name": f"{action_label} {module_label}",
                    "module": module_code,
                    "description": f"{action_label} access for the {module_label} module.",
                }
                obj, created = Permission.objects.update_or_create(
                    codename=codename,
                    defaults=defaults,
                )
                permission_map[codename] = obj
                if created:
                    created_count += 1
                else:
                    updated_count += 1

        for codename, name, module, description in EXTRA_PERMISSIONS:
            obj, created = Permission.objects.update_or_create(
                codename=codename,
                defaults={
                    "name": name,
                    "module": module,
                    "description": description,
                },
            )
            permission_map[codename] = obj
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            f"Permissions: {created_count} created, {updated_count} updated "
            f"({len(permission_map)} total)."
        )
        return permission_map

    def _seed_roles(self, permission_map):
        for role_name, config in SYSTEM_ROLES.items():
            role, created = Role.objects.update_or_create(
                name=role_name,
                defaults={
                    "description": config["description"],
                    "is_system": True,
                    "is_active": True,
                },
            )
            if config.get("all_permissions"):
                role.permissions.set(Permission.objects.all())
            else:
                perms = [
                    permission_map[code]
                    for code in config.get("permissions", [])
                    if code in permission_map
                ]
                role.permissions.set(perms)

            action = "Created" if created else "Updated"
            self.stdout.write(
                f"{action} role '{role_name}' with {role.permissions.count()} permissions."
            )

    def _seed_feature_flags(self):
        for name, codename, is_enabled, description in DEFAULT_FEATURE_FLAGS:
            flag, created = FeatureFlag.objects.update_or_create(
                codename=codename,
                defaults={
                    "name": name,
                    "is_enabled": is_enabled,
                    "description": description,
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"{action} feature flag '{flag.codename}'.")

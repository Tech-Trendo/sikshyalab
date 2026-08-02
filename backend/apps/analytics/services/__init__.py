"""
Role-aware dashboard KPIs matching the frontend dashboard overviews.

Admin   → platform-wide stats (students, batches, courses, revenue, …)
Teacher → assigned courses/batches/students, pending reviews, open portals
Student → enrolled courses, open assignments, tasks, certificates, fees

Public API is unchanged: import from apps.analytics.services (or
apps.analytics import services).
"""

from apps.analytics.services._common import teacher_scope_filters
from apps.analytics.services.dashboards import (
    admin_dashboard_summary,
    dashboard_stats,
    student_dashboard_summary,
    teacher_dashboard_summary,
)
from apps.analytics.services.reports import (
    assignment_completion,
    attendance_reports,
    certificate_stats,
    enrollment_trends,
    revenue_summary,
    student_growth,
    teacher_performance,
)

__all__ = [
    "admin_dashboard_summary",
    "assignment_completion",
    "attendance_reports",
    "certificate_stats",
    "dashboard_stats",
    "enrollment_trends",
    "revenue_summary",
    "student_dashboard_summary",
    "student_growth",
    "teacher_dashboard_summary",
    "teacher_performance",
    "teacher_scope_filters",
]

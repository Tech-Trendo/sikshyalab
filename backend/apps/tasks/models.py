"""
Learning task board (teacher assigns → student advances forward-only).
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel


class BoardTask(BaseModel):
    class Status(models.TextChoices):
        TO_DO = "TO_DO", _("To Do")
        IN_PROGRESS = "IN_PROGRESS", _("In Progress")
        SUBMITTED = "SUBMITTED", _("Submitted")
        COMPLETED = "COMPLETED", _("Completed")

    title = models.CharField(max_length=255)
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="board_tasks",
    )
    course_title = models.CharField(max_length=255, blank=True)
    due = models.CharField(max_length=64, blank=True, help_text=_("Display due date"))
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TO_DO,
        db_index=True,
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="board_tasks",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_board_tasks",
    )
    assigned_by = models.CharField(max_length=150, blank=True)
    created_by_role = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        verbose_name = _("board task")
        verbose_name_plural = _("board tasks")
        indexes = [
            models.Index(fields=["student", "status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"

    @property
    def status_label(self) -> str:
        return {
            self.Status.TO_DO: "To Do",
            self.Status.IN_PROGRESS: "In Progress",
            self.Status.SUBMITTED: "Submitted",
            self.Status.COMPLETED: "Completed",
        }.get(self.status, self.status)

    STATUS_ORDER = [
        Status.TO_DO,
        Status.IN_PROGRESS,
        Status.SUBMITTED,
        Status.COMPLETED,
    ]

    def can_advance(self) -> bool:
        try:
            idx = self.STATUS_ORDER.index(self.status)
        except ValueError:
            return False
        return idx < len(self.STATUS_ORDER) - 1

    def advance(self) -> bool:
        if not self.can_advance():
            return False
        idx = self.STATUS_ORDER.index(self.status)
        self.status = self.STATUS_ORDER[idx + 1]
        self.save(update_fields=["status", "updated_at"])
        return True

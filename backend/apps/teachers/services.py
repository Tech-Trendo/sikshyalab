"""Teacher profile helpers shared by accounts provisioning and teacher APIs."""

from __future__ import annotations

import re

from apps.accounts.models import UserProfile


def parse_years_of_experience(value) -> int | None:
    """Parse admin/dashboard strings like ``5 yrs`` or ``5+`` into an integer."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    text = str(value).strip().lower()
    if not text:
        return None
    match = re.search(r"(\d+)", text)
    if not match:
        return None
    return max(0, int(match.group(1)))


def teacher_profile_title(*, designation: str = "", years_of_experience: int | None = None) -> str:
    """Build a display title shown on the account profile page."""
    parts: list[str] = []
    if designation and designation.strip():
        parts.append(designation.strip())
    if years_of_experience is not None and years_of_experience > 0:
        parts.append(f"{years_of_experience} yrs")
    return " · ".join(parts)


def sync_teacher_user_profile(teacher) -> None:
    """Mirror teacher designation/bio/experience onto UserProfile for /auth/profile/."""
    user = teacher.user
    profile, _ = UserProfile.objects.get_or_create(user=user)
    title = teacher_profile_title(
        designation=teacher.designation or "",
        years_of_experience=teacher.years_of_experience,
    )
    profile_updates: list[str] = []
    if title and profile.title != title:
        profile.title = title
        profile_updates.append("title")
    if teacher.bio and profile.bio != teacher.bio:
        profile.bio = teacher.bio
        profile_updates.append("bio")
    if profile_updates:
        profile.save(update_fields=profile_updates + ["updated_at"])


def apply_teacher_admin_fields(
    user,
    *,
    designation: str | None = None,
    bio: str | None = None,
    years_of_experience: int | None = None,
):
    """
    Persist admin-provided teacher metadata and sync it to the auth profile.

    Returns the Teacher instance when updated, otherwise None.
    """
    from apps.teachers.models import Teacher

    teacher = Teacher.objects.filter(user=user).first()
    if teacher is None:
        return None

    updates: list[str] = []
    if designation is not None and designation.strip():
        teacher.designation = designation.strip()
        updates.append("designation")
    if bio is not None and bio.strip():
        teacher.bio = bio.strip()
        updates.append("bio")
    if years_of_experience is not None:
        teacher.years_of_experience = years_of_experience
        updates.append("years_of_experience")

    if updates:
        teacher.save(update_fields=updates + ["updated_at"])
        sync_teacher_user_profile(teacher)
    return teacher

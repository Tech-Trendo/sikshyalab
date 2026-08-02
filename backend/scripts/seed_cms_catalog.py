#!/usr/bin/env python
"""CMS/catalog demo seeding is disabled. Use the dashboard/CMS to add real content."""

from __future__ import annotations

import sys

print(
    "CMS catalog seeding is disabled.\n"
    "Add courses, blog, events, FAQs, etc. from the dashboard Content / Courses pages.\n"
    "To wipe leftover demo rows: python scripts/clear_demo_data.py",
    file=sys.stderr,
)
sys.exit(1)


def seed(*_args, **_kwargs):
    raise RuntimeError("CMS catalog seeding is disabled")

#!/usr/bin/env python
"""Demo seeding is disabled. Use the dashboard/CMS to add real content."""

from __future__ import annotations

import sys

print(
    "Demo seeding is disabled.\n"
    "Add real content from the dashboard (Courses, Content, Students, etc.).\n"
    "To wipe leftover demo rows: python scripts/clear_demo_data.py",
    file=sys.stderr,
)
sys.exit(1)

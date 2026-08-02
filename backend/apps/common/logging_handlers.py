"""Windows-safe rotating log handler (Django runserver + OneDrive file locks)."""

from __future__ import annotations

from logging.handlers import RotatingFileHandler


class SafeRotatingFileHandler(RotatingFileHandler):
    """
    RotatingFileHandler that ignores WinError 32 when another process holds the log.

    Django's runserver runs parent + child workers that both open the same file;
    on Windows (especially under OneDrive) rename() during rollover often fails.
    Swallow silently — do not log (avoids DEBUG spam on every request).
    """

    def doRollover(self) -> None:  # noqa: N802 — stdlib API
        try:
            super().doRollover()
        except PermissionError:
            # Keep writing to the current file; rotation can succeed later.
            return
        except OSError as exc:
            # WinError 32 is PermissionError on modern Python; keep a broad guard.
            if getattr(exc, "winerror", None) == 32 or getattr(exc, "errno", None) in (13, 16):
                return
            raise

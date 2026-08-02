"""
Django settings package.

Defaults to development settings. Override with:
  DJANGO_SETTINGS_MODULE=config.settings.production
"""

from .development import *  # noqa: F401, F403

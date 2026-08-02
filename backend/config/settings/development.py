"""
ShikshaLab — development settings.
"""

from .base import *  # noqa: F401, F403
from decouple import Csv, config

DEBUG = True

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*", cast=Csv())

SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-dev-only-shikshalab-do-not-use-in-prod",
)


# Database — PostgreSQL required
# --------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": config("DB_ENGINE", default="django.db.backends.postgresql"),
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=60, cast=int),
        "OPTIONS": {
            "connect_timeout": 10,
            "sslmode": config("DB_SSLMODE", default="prefer"),
        },
    }
}

# ---------------------------------------------------------------------------
# CORS — permissive in development
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = config("CORS_ALLOW_ALL_ORIGINS", default=True, cast=bool)

# ---------------------------------------------------------------------------
# CSRF — trust LAN origins (login / session edges)
# ---------------------------------------------------------------------------
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default=(
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://192.168.100.154:8081,http://192.168.100.154:5173,"
        "http://192.168.100.154:8000"
    ),
    cast=Csv(),
)


STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"

# ---------------------------------------------------------------------------
# Logging — more verbose in development
# ---------------------------------------------------------------------------
LOGGING["root"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["apps"]["level"] = "DEBUG"  # noqa: F405
LOGGING["handlers"]["console"]["level"] = "DEBUG"  # noqa: F405
# Avoid Windows file-lock rollover noise: plain append in local dev.
LOGGING["handlers"]["file"] = {  # noqa: F405
    "class": "logging.FileHandler",
    "filename": LOGS_DIR / "shikshalab.log",  # noqa: F405
    "formatter": "verbose",
    "level": "INFO",
    "delay": True,
}
# ---------------------------------------------------------------------------
# DRF — browsable API enabled
# ---------------------------------------------------------------------------
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
)

# ---------------------------------------------------------------------------
# Optional debug toolbar
# ---------------------------------------------------------------------------
if config("ENABLE_DEBUG_TOOLBAR", default=False, cast=bool):
    INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405
    INTERNAL_IPS = ["127.0.0.1", "localhost"]

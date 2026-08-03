"""
ShikshaLab — base Django settings shared by all environments.
"""

import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# config/settings/base.py → project root is three levels up
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-change-me-in-production-shikshalab",
)
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "channels",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "auditlog",
    "django_extensions",
    "whitenoise.runserver_nostatic",
]

LOCAL_APPS = [
    "apps.common",
    "apps.accounts",
    "apps.roles",
    "apps.students",
    "apps.teachers",
    "apps.courses",
    "apps.content",
    "apps.batches",
    "apps.enrollments",
    "apps.fees",
    "apps.assignments",
    "apps.certificates",
    "apps.cms",
    "apps.seo",
    "apps.notifications.apps.NotificationsConfig",
    "apps.analytics.apps.AnalyticsConfig",
    "apps.tasks.apps.TasksConfig",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Rewrite /api/foo → /api/v1/foo before URL routing (no duplicate namespaces)
    "apps.common.middleware_api_compat.ApiV1CompatMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "auditlog.middleware.AuditlogMiddleware",
    "apps.common.middleware.RequestLoggingMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Database (override in environment-specific settings — PostgreSQL)
# ---------------------------------------------------------------------------
DATABASES = {}

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "apps.accounts.validators.ComplexPasswordValidator"},
]

# Password reset OTP
PASSWORD_RESET_OTP_EXPIRY_MINUTES = config("PASSWORD_RESET_OTP_EXPIRY_MINUTES", default=10, cast=int)
PASSWORD_RESET_OTP_MAX_ATTEMPTS = config("PASSWORD_RESET_OTP_MAX_ATTEMPTS", default=5, cast=int)
PASSWORD_RESET_LOCKOUT_ATTEMPTS = config("PASSWORD_RESET_LOCKOUT_ATTEMPTS", default=5, cast=int)
PASSWORD_RESET_LOCKOUT_MINUTES = config("PASSWORD_RESET_LOCKOUT_MINUTES", default=30, cast=int)
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = config(
    "PASSWORD_RESET_TOKEN_EXPIRY_MINUTES", default=15, cast=int
)

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kathmandu"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media (WhiteNoise)
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = config("CORS_ALLOW_CREDENTIALS", default=True, cast=bool)
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "DEFAULT_PARSER_CLASSES": (
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ),
    "EXCEPTION_HANDLER": "apps.common.exceptions.custom_exception_handler",
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S%z",
    "DATE_FORMAT": "%Y-%m-%d",
    "DEFAULT_THROTTLE_RATES": {
        "notification_send": "60/hour",
        "password_reset": "10/hour",
        "password_reset_otp": "20/hour",
    },
}

# ---------------------------------------------------------------------------
# Simple JWT
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
}

# ---------------------------------------------------------------------------
# DRF Spectacular (OpenAPI)
# ---------------------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "ShikshaLab API",
    "DESCRIPTION": (
        "ShikshaLab Learning Management System API. "
        "Manage courses, batches, enrollments, fees, "
        "assignments, certificates, and more."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1/",
    "COMPONENT_SPLIT_REQUEST": True,
    "SECURITY": [{"BearerAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
    },
    "TAGS": [
        {"name": "Auth", "description": "Authentication & token endpoints"},
        {"name": "Accounts", "description": "User account management"},
        {"name": "Roles", "description": "Role & permission management"},
        {"name": "Students", "description": "Student profiles"},
        {"name": "Teachers", "description": "Teacher profiles"},
        {"name": "Courses", "description": "Course catalog"},
        {"name": "Content", "description": "Course content & materials"},
        {"name": "Batches", "description": "Batch / cohort management"},
        {"name": "Enrollments", "description": "Student enrollments"},
        {"name": "Fees", "description": "Fee plans & payments"},
        {"name": "Assignments", "description": "Assignments & submissions"},
        {"name": "Certificates", "description": "Certificate issuance"},
        {"name": "CMS", "description": "Content management pages"},
        {"name": "SEO", "description": "SEO metadata"},
        {"name": "Notifications", "description": "User notifications"},
        {"name": "Analytics", "description": "Reports & analytics"},
    ],
}

# ---------------------------------------------------------------------------
# Cache / Redis
# ---------------------------------------------------------------------------
REDIS_URL = config("REDIS_URL", default="redis://127.0.0.1:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "shikshalab-default",
    }
}

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default=REDIS_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_TASK_ALWAYS_EAGER = config("CELERY_TASK_ALWAYS_EAGER", default=False, cast=bool)

# ---------------------------------------------------------------------------
# Django Channels (WebSockets)
# ---------------------------------------------------------------------------
_CHANNEL_BACKEND = config(
    "CHANNEL_LAYER_BACKEND",
    default="channels.layers.InMemoryChannelLayer",
)
if _CHANNEL_BACKEND == "channels_redis.core.RedisChannelLayer":
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": _CHANNEL_BACKEND,
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_USE_SSL = config("EMAIL_USE_SSL", default=False, cast=bool)
EMAIL_TIMEOUT = config("EMAIL_TIMEOUT", default=20, cast=int)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@shikshalab.com")
# Optional: Brevo Transactional API (https://app.brevo.com/settings/keys/api)
# If set, credentials emails use the API instead of SMTP.
BREVO_API_KEY = config("BREVO_API_KEY", default="")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGS_DIR = BASE_DIR / "logs"
os.makedirs(LOGS_DIR, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {module}.{funcName}:{lineno} — {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {
            "format": "[{asctime}] {levelname} {name} — {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "level": "DEBUG",
        },
        "file": {
            # SafeRotatingFileHandler: Windows/OneDrive + runserver dual-process
            # often lock shikshalab.log during rename; stdlib RotatingFileHandler
            # then dumps a PermissionError traceback that looks like a request failure.
            "class": "apps.common.logging_handlers.SafeRotatingFileHandler",
            "filename": LOGS_DIR / "shikshalab.log",
            "maxBytes": 10 * 1024 * 1024,  # 10 MB
            "backupCount": 5,
            "formatter": "verbose",
            "level": "INFO",
            "delay": True,
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": config("DJANGO_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console", "file"],
            "level": "DEBUG",
            "propagate": False,
        },
        "apps.common.middleware": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
SITE_URL = config("SITE_URL", default="http://localhost:8000")
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:8081")
PUBLIC_SITE_URL = config("PUBLIC_SITE_URL", default="http://localhost:3000")
SUPERADMIN_EMAIL = config("SUPERADMIN_EMAIL", default="admin@shikshalab.io")
SUPERADMIN_PASSWORD = config("SUPERADMIN_PASSWORD", default="Admin@12345")
DASHBOARD_URL = config("DASHBOARD_URL", default="http://localhost:5173")
CERTIFICATE_VERIFY_BASE_URL = config(
    "CERTIFICATE_VERIFY_BASE_URL",
    default="",
)

# Partner sync (external API → local PostgreSQL Partner table)
# Public site always reads /cms/partners/ from the local DB.
PARTNER_SYNC_API_URL = config("PARTNER_SYNC_API_URL", default="")
PARTNER_SYNC_API_TOKEN = config("PARTNER_SYNC_API_TOKEN", default="")
PARTNER_SYNC_API_TIMEOUT_SECONDS = config(
    "PARTNER_SYNC_API_TIMEOUT_SECONDS", default=30, cast=int
)
PARTNER_SYNC_INTERVAL_DAYS = config("PARTNER_SYNC_INTERVAL_DAYS", default=30, cast=int)

DATA_UPLOAD_MAX_MEMORY_SIZE = config(
    "DATA_UPLOAD_MAX_MEMORY_SIZE", default=10 * 1024 * 1024, cast=int
)
FILE_UPLOAD_MAX_MEMORY_SIZE = config(
    "FILE_UPLOAD_MAX_MEMORY_SIZE", default=10 * 1024 * 1024, cast=int
)

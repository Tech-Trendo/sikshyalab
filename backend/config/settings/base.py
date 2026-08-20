"""
ShikshaLab — base Django settings shared by all environments.
"""

import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config
from botocore.client import Config as BotocoreConfig

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
    "storages",
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
    "apps.seo.apps.SeoConfig",
    "apps.notifications.apps.NotificationsConfig",
    "apps.analytics.apps.AnalyticsConfig",
    "apps.tasks.apps.TasksConfig",
    "apps.videos.apps.VideosConfig",
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

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------------------------------------------------------
# Media storage — local disk (default) or S3-compatible DataHub bucket
# PostgreSQL stores only FileField keys (paths); binaries live in the bucket.
# ---------------------------------------------------------------------------
USE_S3 = config("USE_S3", default=False, cast=bool)

AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME", default="")
AWS_S3_ENDPOINT_URL = config("AWS_S3_ENDPOINT_URL", default="")
AWS_S3_REGION_NAME = config("AWS_S3_REGION_NAME", default="")
AWS_S3_ADDRESSING_STYLE = config("AWS_S3_ADDRESSING_STYLE", default="path")
AWS_S3_SIGNATURE_VERSION = config("AWS_S3_SIGNATURE_VERSION", default="s3v4")
# Empty ACL is required for buckets with "Bucket owner enforced" / ACLs disabled
# (typical for DataHub / AWS S3; do not use Docker MinIO defaults here).
_aws_acl = config("AWS_DEFAULT_ACL", default="")
AWS_DEFAULT_ACL = _aws_acl if _aws_acl else None
AWS_LOCATION = config("AWS_LOCATION", default="")
AWS_QUERYSTRING_AUTH = config("AWS_QUERYSTRING_AUTH", default=True, cast=bool)
AWS_QUERYSTRING_EXPIRE = config("AWS_QUERYSTRING_EXPIRE", default=900, cast=int)
AWS_S3_FILE_OVERWRITE = config("AWS_S3_FILE_OVERWRITE", default=False, cast=bool)
# Short-lived media URLs returned by /content/resources/.../signed-url/ (10–15 min)
MEDIA_SIGNED_URL_EXPIRE = config("MEDIA_SIGNED_URL_EXPIRE", default=900, cast=int)
AWS_S3_OBJECT_PARAMETERS = {
    "CacheControl": config("AWS_S3_CACHE_CONTROL", default="max-age=86400"),
}

# Upload validation limits (validators in apps.common.file_validators)
MEDIA_MAX_IMAGE_BYTES = config("MEDIA_MAX_IMAGE_BYTES", default=5 * 1024 * 1024, cast=int)
MEDIA_MAX_DOCUMENT_BYTES = config("MEDIA_MAX_DOCUMENT_BYTES", default=20 * 1024 * 1024, cast=int)
MEDIA_MAX_VIDEO_BYTES = config("MEDIA_MAX_VIDEO_BYTES", default=200 * 1024 * 1024, cast=int)
MEDIA_MAX_AUDIO_BYTES = config("MEDIA_MAX_AUDIO_BYTES", default=30 * 1024 * 1024, cast=int)
MEDIA_MAX_UPLOAD_BYTES = config("MEDIA_MAX_UPLOAD_BYTES", default=20 * 1024 * 1024, cast=int)

MEDIA_ALLOWED_VIDEO_EXTENSIONS = config(
    "MEDIA_ALLOWED_VIDEO_EXTENSIONS",
    default="mp4,mov,mkv,webm,m4v",
    cast=Csv(),
)

VIDEO_CRF = config("VIDEO_CRF", default=23, cast=int)
VIDEO_PRESET = config("VIDEO_PRESET", default="medium")
VIDEO_CODEC = config("VIDEO_CODEC", default="libx264")
AUDIO_CODEC = config("AUDIO_CODEC", default="aac")
AUDIO_BITRATE = config("AUDIO_BITRATE", default="128k")
# Cap height for web streaming (720 keeps bandwidth low; set 1080 for higher quality).
VIDEO_MAX_HEIGHT = config("VIDEO_MAX_HEIGHT", default=720, cast=int)
# Keep uncompressed original after compression (retry / audit). Set false to delete.
VIDEO_KEEP_ORIGINAL = config("VIDEO_KEEP_ORIGINAL", default=True, cast=bool)
VIDEO_MAX_BYTES = config("VIDEO_MAX_BYTES", default=250 * 1024 * 1024, cast=int)
VIDEO_UPLOAD_TMP_DIR = config("VIDEO_UPLOAD_TMP_DIR", default=str(BASE_DIR / "tmp" / "videos"))
VIDEO_DOWNLOAD_URL_EXPIRY_SECONDS = config(
    "VIDEO_DOWNLOAD_URL_EXPIRY_SECONDS", default=3600, cast=int
)

if USE_S3:
    STORAGES = {
        "default": {
            "BACKEND": "apps.common.storage.MediaStorage",
            "OPTIONS": {
                "access_key": AWS_ACCESS_KEY_ID,
                "secret_key": AWS_SECRET_ACCESS_KEY,
                "bucket_name": AWS_STORAGE_BUCKET_NAME,
                "endpoint_url": AWS_S3_ENDPOINT_URL or None,
                "region_name": AWS_S3_REGION_NAME or None,
                "default_acl": AWS_DEFAULT_ACL,
                "querystring_auth": AWS_QUERYSTRING_AUTH,
                "querystring_expire": AWS_QUERYSTRING_EXPIRE,
                "file_overwrite": AWS_S3_FILE_OVERWRITE,
                "location": AWS_LOCATION or "",
                "object_parameters": AWS_S3_OBJECT_PARAMETERS,
                "custom_domain": None,
                "client_config": BotocoreConfig(
                    signature_version=AWS_S3_SIGNATURE_VERSION or "s3v4",
                    s3={"addressing_style": AWS_S3_ADDRESSING_STYLE or "path"},
                ),
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    # Keep MEDIA_URL as the API media gateway so auth gating still applies.
    # AuthenticatedMediaView streams object bytes (HTTP 200) from the bucket.
    # PostgreSQL stores only relative keys; binaries live in S3. Uploads are
    # also mirrored under local MEDIA_ROOT so DEBUG static() can serve them.
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {
                "location": str(MEDIA_ROOT),
                "base_url": MEDIA_URL,
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)
# Required so the browser sends the httpOnly media cookie on cross-origin API/media calls
CORS_ALLOW_CREDENTIALS = config("CORS_ALLOW_CREDENTIALS", default=True, cast=bool)

# ---------------------------------------------------------------------------
# Media session cookie (httpOnly) — used only by /content/resources/<id>/stream/
# Regular APIs continue to use Authorization: Bearer JWT.
# ---------------------------------------------------------------------------
MEDIA_COOKIE_NAME = config("MEDIA_COOKIE_NAME", default="sl_media_session")
MEDIA_COOKIE_SAMESITE = config("MEDIA_COOKIE_SAMESITE", default="Lax")
MEDIA_COOKIE_SECURE = config("MEDIA_COOKIE_SECURE", default=False, cast=bool)
# Align with access-token lifetime (seconds). Refresh endpoint rotates the cookie.
MEDIA_COOKIE_MAX_AGE = config("MEDIA_COOKIE_MAX_AGE", default=3600, cast=int)

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.common.authentication.ShikshaLabJWTAuthentication",
        "apps.common.authentication.ShikshaLabSessionAuthentication",
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
        # Keep S3 SDK signature dumps out of the console
        "botocore": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
        "boto3": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
        "s3transfer": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
        "urllib3": {
            "handlers": ["console", "file"],
            "level": "WARNING",
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
SITEMAP_MAX_URLS = config("SITEMAP_MAX_URLS", default=50000, cast=int)
SUPERADMIN_EMAIL = config("SUPERADMIN_EMAIL", default="admin@shikshalab.io")
SUPERADMIN_PASSWORD = config("SUPERADMIN_PASSWORD", default="Admin@12345")
DASHBOARD_URL = config("DASHBOARD_URL", default="http://localhost:5173")
CERTIFICATE_VERIFY_BASE_URL = config(
    "CERTIFICATE_VERIFY_BASE_URL",
    default="",
)

# Google reCAPTCHA (public site key + server secret). Leave empty to disable checks.
RECAPTCHA_SITE_KEY = config("RECAPTCHA_SITE_KEY", default="")
RECAPTCHA_SECRET_KEY = config("RECAPTCHA_SECRET_KEY", default="")
# For reCAPTCHA v3 only; 0 disables score gating (correct for v2 checkbox).
RECAPTCHA_MIN_SCORE = config("RECAPTCHA_MIN_SCORE", default=0.0, cast=float)

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

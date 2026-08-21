"""
ShikshaLab — production settings.

Requires environment variables for SECRET_KEY, database, and hosts.
"""

from .base import *  # noqa: F401, F403
from decouple import Csv, config

DEBUG = False

SECRET_KEY = config("SECRET_KEY")  # required — no default

ALLOWED_HOSTS = config("ALLOWED_HOSTS", cast=Csv())

# ---------------------------------------------------------------------------
# Database — PostgreSQL required
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": config("DB_ENGINE", default="django.db.backends.postgresql"),
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=600, cast=int),
        "OPTIONS": {
            "connect_timeout": 10,
            "sslmode": config("DB_SSLMODE", default="prefer"),
        },
    }
}

# ---------------------------------------------------------------------------
# HTTPS / security hardening
# ---------------------------------------------------------------------------
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31536000, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
MEDIA_COOKIE_SECURE = True
# Use None when SPA and API are different sites over HTTPS (requires Secure above).
MEDIA_COOKIE_SAMESITE = config("MEDIA_COOKIE_SAMESITE", default="Lax")
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# ---------------------------------------------------------------------------
# CORS / CSRF — explicit origins only (scheme required for CSRF, e.g. https://…)
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", cast=Csv())
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", cast=Csv())

# ---------------------------------------------------------------------------
# Redis cache
# ---------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://127.0.0.1:6379/1"),
        "KEY_PREFIX": "shikshalab",
        "TIMEOUT": 300,
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("REDIS_URL", default="redis://127.0.0.1:6379/0")],
        },
    }
}

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend",
)

# ---------------------------------------------------------------------------
# Media — served via AuthenticatedMediaView (local disk or streamed from DataHub S3).
# Set USE_S3=true + AWS_* in .env for your DataHub / S3-compatible bucket (no Docker).
# WhiteNoise only covers STATIC files, not MEDIA.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# DRF — no browsable API in production
# ---------------------------------------------------------------------------
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
)
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = [  # noqa: F405
    "rest_framework.throttling.AnonRateThrottle",
    "rest_framework.throttling.UserRateThrottle",
]
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "anon": config("THROTTLE_ANON", default="100/hour"),
    "user": config("THROTTLE_USER", default="1000/hour"),
}

# ---------------------------------------------------------------------------
# Logging — less noise, keep file + console
# ---------------------------------------------------------------------------
LOGGING["root"]["level"] = "WARNING"  # noqa: F405
LOGGING["loggers"]["django"]["level"] = "WARNING"  # noqa: F405
LOGGING["loggers"]["apps"]["level"] = "INFO"  # noqa: F405

# ---------------------------------------------------------------------------
# Sentry (optional)
# ---------------------------------------------------------------------------
SENTRY_DSN = config("SENTRY_DSN", default="")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration(), CeleryIntegration()],
            traces_sample_rate=config("SENTRY_TRACES_SAMPLE_RATE", default=0.1, cast=float),
            send_default_pii=False,
            environment=config("SENTRY_ENVIRONMENT", default="production"),
        )
    except ImportError:
        pass

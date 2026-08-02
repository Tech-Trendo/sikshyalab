try:
    from .celery import app as celery_app
except ImportError:  # Celery not installed in this environment
    celery_app = None

__all__ = ("celery_app",)

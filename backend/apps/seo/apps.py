from django.apps import AppConfig


class SeoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.seo"
    label = "seo"
    verbose_name = "SEO"

    def ready(self):
        from apps.seo import signals  # noqa: F401

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.seo.models import SitemapEntry
from apps.seo.sitemap_utils import bump_sitemap_cache


@receiver(post_save, sender=SitemapEntry)
def sitemap_entry_saved(sender, instance, **kwargs):
    bump_sitemap_cache()


@receiver(post_delete, sender=SitemapEntry)
def sitemap_entry_deleted(sender, instance, **kwargs):
    bump_sitemap_cache()

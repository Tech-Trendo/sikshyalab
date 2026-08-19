"""Serializers for the SEO module."""

from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers

from apps.common.serializers_media import SafeMediaRepresentationMixin
from apps.common.seo import apply_seo_fallbacks
from apps.seo.models import RedirectRule, SEOMetadata, SitemapEntry
from apps.seo.services import calculate_seo_score, refresh_seo_score


class SEOMetadataSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("og_image", "twitter_image")
    content_type_label = serializers.SerializerMethodField()
    calculated_score = serializers.SerializerMethodField()

    class Meta:
        model = SEOMetadata
        fields = [
            "id",
            "content_type",
            "content_type_label",
            "object_id",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "slug",
            "canonical_url",
            "og_title",
            "og_description",
            "og_image",
            "og_type",
            "twitter_card",
            "twitter_title",
            "twitter_description",
            "twitter_image",
            "robots",
            "structured_data",
            "focus_keyword",
            "seo_score",
            "calculated_score",
            "is_indexed",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "seo_score", "created_at", "updated_at"]

    def get_content_type_label(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"

    def get_calculated_score(self, obj):
        return calculate_seo_score(obj)

    def create(self, validated_data):
        instance = super().create(validated_data)
        refresh_seo_score(instance, save=True)
        return instance

    def update(self, instance, validated_data):
        incoming_sd = validated_data.pop("structured_data", None)
        instance = super().update(instance, validated_data)
        if incoming_sd is not None and isinstance(incoming_sd, dict):
            merged = {
                **(instance.structured_data if isinstance(instance.structured_data, dict) else {}),
                **incoming_sd,
            }
            instance.structured_data = merged
            instance.save(update_fields=["structured_data", "updated_at"])
        refresh_seo_score(instance, save=True)
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return apply_seo_fallbacks(
            data,
            title=instance.meta_title or instance.og_title,
            description=instance.meta_description or instance.og_description,
            fallback_image_url=data.get("twitter_image"),
        )


class SEOMetadataPublicSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("og_image", "twitter_image")
    content_type_label = serializers.SerializerMethodField()

    class Meta:
        model = SEOMetadata
        fields = [
            "meta_title",
            "meta_description",
            "meta_keywords",
            "slug",
            "canonical_url",
            "og_title",
            "og_description",
            "og_image",
            "og_type",
            "twitter_card",
            "twitter_title",
            "twitter_description",
            "twitter_image",
            "robots",
            "structured_data",
            "focus_keyword",
            "seo_score",
            "is_indexed",
            "content_type_label",
            "object_id",
        ]

    def get_content_type_label(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get("og_image"):
            extra = instance.structured_data if isinstance(instance.structured_data, dict) else {}
            url = extra.get("og_image_url")
            if url:
                data["og_image"] = url
        return apply_seo_fallbacks(
            data,
            title=instance.meta_title or instance.og_title,
            description=instance.meta_description or instance.og_description,
            fallback_image_url=data.get("twitter_image"),
        )


class SitemapEntrySerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    change_frequency = serializers.CharField(source="changefreq", required=False)
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = SitemapEntry
        fields = [
            "id",
            "title",
            "slug",
            "url_path",
            "url",
            "page_type",
            "parent",
            "is_published",
            "is_indexable",
            "is_active",
            "changefreq",
            "change_frequency",
            "priority",
            "lastmod",
            "order",
            "children_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "url", "is_active", "created_at", "updated_at"]

    def get_url(self, obj):
        from apps.seo.sitemap_utils import canonical_url

        return canonical_url(obj.url_path)

    def get_children_count(self, obj):
        annotated = getattr(obj, "children_count_annotated", None)
        if annotated is not None:
            return int(annotated)
        cache = getattr(obj, "_prefetched_objects_cache", None)
        if cache is not None and "children" in cache:
            return len(obj.children.all())
        return obj.children.count()

    def validate_url_path(self, value):
        from apps.seo.sitemap_utils import normalize_url_path

        try:
            return normalize_url_path(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_slug(self, value):
        slug = (value or "").strip().strip("/") or "home"
        return slug

    def validate(self, attrs):
        from apps.seo.sitemap_utils import would_create_cycle

        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        instance = self.instance
        if instance is not None and parent is not None:
            if parent.pk == instance.pk:
                raise serializers.ValidationError(
                    {"parent": "A page cannot be its own parent."}
                )
            if would_create_cycle(instance, parent):
                raise serializers.ValidationError(
                    {"parent": "Parent cannot create a circular relationship."}
                )
        return attrs


class SitemapPagePublicSerializer(serializers.Serializer):
    """Read-only hierarchical node for the Next.js frontend."""

    id = serializers.UUIDField()
    title = serializers.CharField()
    slug = serializers.CharField()
    url = serializers.URLField()
    path = serializers.CharField()
    page_type = serializers.CharField()
    priority = serializers.FloatField()
    change_frequency = serializers.CharField()
    updated_at = serializers.CharField(allow_null=True)
    children = serializers.ListField(child=serializers.DictField(), required=False)


class SitemapPageFlatSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    change_frequency = serializers.CharField(source="changefreq", read_only=True)
    path = serializers.CharField(source="url_path", read_only=True)

    class Meta:
        model = SitemapEntry
        fields = [
            "id",
            "title",
            "slug",
            "path",
            "url",
            "page_type",
            "parent",
            "priority",
            "change_frequency",
            "updated_at",
        ]

    def get_url(self, obj):
        from apps.seo.sitemap_utils import canonical_url

        return canonical_url(obj.url_path)


class RedirectRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RedirectRule
        fields = [
            "id",
            "from_path",
            "to_path",
            "status_code",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ContentTypeLookupSerializer(serializers.Serializer):
    app_label = serializers.CharField(required=False, allow_blank=True)
    model = serializers.CharField(required=False, allow_blank=True)
    content_type = serializers.PrimaryKeyRelatedField(
        queryset=ContentType.objects.all(),
        required=False,
    )
    object_id = serializers.CharField(required=False, max_length=64, allow_blank=True)
    slug = serializers.SlugField(required=False, allow_blank=True)
    # allow_blank so ``?path=/`` and ``?path=`` (treated as home) validate cleanly
    path = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get("content_type") is None:
            app_label = (attrs.get("app_label") or "").strip()
            model = (attrs.get("model") or "").strip()
            if app_label and model:
                try:
                    attrs["content_type"] = ContentType.objects.get(
                        app_label=app_label, model=model.lower()
                    )
                except ContentType.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {"content_type": "Content type not found."}
                    ) from exc

        # Normalize empty path to homepage ``/`` when path was provided.
        if "path" in self.initial_data:
            raw_path = attrs.get("path")
            attrs["path"] = (raw_path if raw_path is not None else "").strip() or "/"

        has_object = attrs.get("content_type") and attrs.get("object_id")
        has_slug = bool((attrs.get("slug") or "").strip())
        has_path = "path" in attrs
        if not (has_object or has_slug or has_path):
            raise serializers.ValidationError(
                "Provide content_type+object_id, slug, or path."
            )
        return attrs

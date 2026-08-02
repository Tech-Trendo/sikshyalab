"""Serializers for the SEO module."""

from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers

from apps.seo.models import RedirectRule, SEOMetadata, SitemapEntry
from apps.seo.services import calculate_seo_score, refresh_seo_score


class SEOMetadataSerializer(serializers.ModelSerializer):
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


class SEOMetadataPublicSerializer(serializers.ModelSerializer):
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
        return data


class SitemapEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SitemapEntry
        fields = [
            "id",
            "url_path",
            "changefreq",
            "priority",
            "lastmod",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


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
    app_label = serializers.CharField(required=False)
    model = serializers.CharField(required=False)
    content_type = serializers.PrimaryKeyRelatedField(
        queryset=ContentType.objects.all(),
        required=False,
    )
    object_id = serializers.CharField(required=False, max_length=64)
    slug = serializers.SlugField(required=False)
    path = serializers.CharField(required=False)

    def validate(self, attrs):
        if attrs.get("content_type") is None:
            app_label = attrs.get("app_label")
            model = attrs.get("model")
            if app_label and model:
                try:
                    attrs["content_type"] = ContentType.objects.get(
                        app_label=app_label, model=model.lower()
                    )
                except ContentType.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {"content_type": "Content type not found."}
                    ) from exc

        has_object = attrs.get("content_type") and attrs.get("object_id")
        has_slug = bool(attrs.get("slug"))
        has_path = bool(attrs.get("path"))
        if not (has_object or has_slug or has_path):
            raise serializers.ValidationError(
                "Provide content_type+object_id, slug, or path."
            )
        return attrs

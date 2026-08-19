"""Serializers for the CMS module."""

from django.utils.text import slugify
from rest_framework import serializers

from apps.cms.models import (
    Announcement,
    Banner,
    BlogPost,
    BlogSection,
    Career,
    CMSTeacherHighlight,
    ContactMessage,
    CourseReview,
    Event,
    EventRegistration,
    FAQ,
    GalleryItem,
    Page,
    Partner,
    SiteSetting,
    Testimonial,
)
from apps.common.html import sanitize_rich_text
from apps.common.seo import SEO_FIELD_KWARGS, apply_seo_fallbacks
from apps.common.serializers_media import SafeMediaRepresentationMixin
from apps.courses.models import Course


class SiteSettingSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("logo", "favicon", "og_image")

    # Ensure latitude/longitude come back as JSON numbers.
    # DRF's default DecimalField behavior is to coerce to string, which can
    # break some map libraries expecting numeric inputs.
    latitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        allow_null=True,
        required=False,
        coerce_to_string=False,
    )
    longitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        allow_null=True,
        required=False,
        coerce_to_string=False,
    )

    class Meta:
        model = SiteSetting
        fields = [
            "id",
            "site_name",
            "tagline",
            "logo",
            "favicon",
            "contact_email",
            "contact_phone",
            "address",
            "latitude",
            "longitude",
            "social_links",
            "footer_text",
            "features_eyebrow",
            "features_heading",
            "homepage_features",
            "testimonials_eyebrow",
            "testimonials_heading",
            "og_title",
            "og_description",
            "og_image",
            "google_search_console_verification",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "og_title": {"required": False, "allow_blank": True},
            "og_description": {"required": False, "allow_blank": True},
            "og_image": {"required": False, "allow_null": True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Expose unset verification as null (not empty string).
        raw = data.get("google_search_console_verification")
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            data["google_search_console_verification"] = None
        else:
            data["google_search_console_verification"] = str(raw).strip()
        return apply_seo_fallbacks(
            data,
            title=instance.site_name,
            description=instance.tagline,
            fallback_image_url=data.get("logo"),
        )


class BannerSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("image", "mobile_image")

    class Meta:
        model = Banner
        fields = [
            "id",
            "title",
            "subtitle",
            "image",
            "mobile_image",
            "cta_text",
            "cta_url",
            "placement",
            "order",
            "is_active",
            "is_published",
            "start_date",
            "end_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PageSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("featured_image",)

    class Meta:
        model = Page
        fields = [
            "id",
            "title",
            "slug",
            "content",
            "page_type",
            "is_published",
            "featured_image",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BlogSectionSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("image",)

    class Meta:
        model = BlogSection
        fields = [
            "id",
            "blog_post",
            "title",
            "description",
            "image",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "blog_post", "created_at", "updated_at"]
        extra_kwargs = {
            "title": {"required": False, "allow_blank": True, "allow_null": True},
            "order": {"required": False},
            "image": {"required": False, "allow_null": True},
        }

    def validate_title(self, value):
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    def validate_description(self, value):
        value = sanitize_rich_text((value or "").strip())
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def validate(self, attrs):
        post = (
            attrs.get("blog_post")
            or self.context.get("blog_post")
            or getattr(self.instance, "blog_post", None)
        )
        nested = getattr(self, "parent", None) is not None
        if post is None and not nested:
            raise serializers.ValidationError({"blog_post": "Blog post is required."})
        if post is not None and self.instance is None:
            initial = self.initial_data if isinstance(self.initial_data, dict) else {}
            if "order" not in initial:
                last = (
                    BlogSection.objects.filter(blog_post=post)
                    .order_by("-order")
                    .values_list("order", flat=True)
                    .first()
                )
                attrs["order"] = 0 if last is None else last + 1
        return attrs


class BlogPostSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("cover_image", "og_image")
    author_name = serializers.SerializerMethodField()
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=270, validators=[])
    sections = BlogSectionSerializer(many=True, required=False)

    class Meta:
        model = BlogPost
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "content",
            "sections",
            "author",
            "author_name",
            "cover_image",
            "meta_title",
            "meta_description",
            "og_title",
            "og_description",
            "og_image",
            "category",
            "tags",
            "is_published",
            "published_at",
            "views_count",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "views_count",
            "published_at",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "content": {"required": False, "allow_blank": True},
            "cover_image": {"required": False, "allow_null": True},
            **SEO_FIELD_KWARGS,
        }

    def get_author_name(self, obj):
        if obj.author is None:
            return ""
        return obj.author.get_full_name()

    def _slug_taken(self, slug: str, *, exclude_pk=None) -> bool:
        qs = BlogPost.all_objects.filter(slug=slug)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        return qs.exists()

    def _unique_slug(self, base: str, *, exclude_pk=None) -> str:
        slug_base = slugify(base) or "post"
        slug = slug_base
        counter = 1
        while self._slug_taken(slug, exclude_pk=exclude_pk):
            slug = f"{slug_base}-{counter}"
            counter += 1
        return slug

    def validate(self, attrs):
        attrs = super().validate(attrs)
        exclude_pk = self.instance.pk if self.instance else None
        # Partial updates that omit slug must keep the existing slug (dashboard
        # PATCH only sends title/excerpt/content and looks up by URL slug).
        if self.instance is not None and "slug" not in attrs:
            return attrs
        raw_slug = (attrs.get("slug") or "").strip()
        title = attrs.get("title") or (
            self.instance.title if self.instance is not None else "post"
        )
        if not raw_slug:
            attrs["slug"] = self._unique_slug(title, exclude_pk=exclude_pk)
        elif self._slug_taken(raw_slug, exclude_pk=exclude_pk):
            attrs["slug"] = self._unique_slug(raw_slug, exclude_pk=exclude_pk)
        else:
            attrs["slug"] = raw_slug
        return attrs

    def _sync_sections(self, post, items):
        previous = list(
            BlogSection.objects.filter(blog_post=post).order_by("order", "created_at")
        )
        BlogSection.objects.filter(blog_post=post).delete()
        for index, item in enumerate(items or []):
            image = item.get("image")
            if not image and index < len(previous) and previous[index].image:
                image = previous[index].image
            BlogSection.objects.create(
                blog_post=post,
                title=item.get("title") or None,
                description=item["description"],
                image=image,
                order=item.get("order", index),
            )
        if items:
            post.content = items[0]["description"]
            post.save(update_fields=["content", "updated_at"])

    def create(self, validated_data):
        sections = validated_data.pop("sections", None)
        post = super().create(validated_data)
        if sections is not None:
            self._sync_sections(post, sections)
        elif (post.content or "").strip():
            BlogSection.objects.create(
                blog_post=post,
                title=None,
                description=post.content,
                order=0,
            )
        return post

    def update(self, instance, validated_data):
        sections = validated_data.pop("sections", serializers.empty)
        post = super().update(instance, validated_data)
        if sections is not serializers.empty:
            self._sync_sections(post, sections)
        return post

    def to_representation(self, instance):
        data = super().to_representation(instance)
        sections = data.get("sections") or []
        first_desc = ""
        if sections:
            first_desc = sections[0].get("description") or ""
        fallback_desc = first_desc or instance.excerpt or instance.content
        return apply_seo_fallbacks(
            data,
            title=instance.title,
            description=fallback_desc,
            fallback_image_url=data.get("cover_image"),
        )


class EventSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("cover_image", "og_image")
    course_title = serializers.CharField(source="course.title", read_only=True)
    course_slug = serializers.CharField(source="course.slug", read_only=True)
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=270, validators=[])

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "location",
            "course",
            "course_title",
            "course_slug",
            "start_datetime",
            "end_datetime",
            "cover_image",
            "meta_title",
            "meta_description",
            "og_title",
            "og_description",
            "og_image",
            "is_published",
            "registration_url",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "course": {"queryset": Course.objects.all(), "required": False, "allow_null": True},
            "slug": {"required": False, "allow_blank": True},
            "cover_image": {"required": False, "allow_null": True},
            **SEO_FIELD_KWARGS,
        }

    def _slug_taken(self, slug: str, *, exclude_pk=None) -> bool:
        qs = Event.all_objects.filter(slug=slug)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        return qs.exists()

    def _unique_slug(self, base: str, *, exclude_pk=None) -> str:
        slug_base = slugify(base) or "event"
        slug = slug_base
        counter = 1
        while self._slug_taken(slug, exclude_pk=exclude_pk):
            slug = f"{slug_base}-{counter}"
            counter += 1
        return slug

    def validate(self, attrs):
        attrs = super().validate(attrs)
        exclude_pk = self.instance.pk if self.instance else None
        if self.instance is not None and "slug" not in attrs:
            return attrs
        raw_slug = (attrs.get("slug") or "").strip()
        title = attrs.get("title") or (
            self.instance.title if self.instance is not None else "event"
        )
        if not raw_slug:
            attrs["slug"] = self._unique_slug(title, exclude_pk=exclude_pk)
        elif self._slug_taken(raw_slug, exclude_pk=exclude_pk):
            attrs["slug"] = self._unique_slug(raw_slug, exclude_pk=exclude_pk)
        else:
            attrs["slug"] = raw_slug
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return apply_seo_fallbacks(
            data,
            title=instance.title,
            description=instance.description,
            fallback_image_url=data.get("cover_image"),
        )


class GalleryItemSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("image",)
    event_title = serializers.SerializerMethodField()
    event_slug = serializers.SerializerMethodField()
    course_slug = serializers.SerializerMethodField()
    course_title = serializers.SerializerMethodField()

    class Meta:
        model = GalleryItem
        fields = [
            "id",
            "title",
            "image",
            "category",
            "event",
            "event_title",
            "event_slug",
            "course_slug",
            "course_title",
            "order",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "event": {"required": False, "allow_null": True},
        }

    def get_event_title(self, obj):
        return obj.event.title if obj.event_id else ""

    def get_event_slug(self, obj):
        return obj.event.slug if obj.event_id else ""

    def get_course_slug(self, obj):
        if obj.event_id and obj.event.course_id:
            return obj.event.course.slug
        return ""

    def get_course_title(self, obj):
        if obj.event_id and obj.event.course_id:
            return obj.event.course.title
        return ""

    def create(self, validated_data):
        event = validated_data.get("event")
        if event and not validated_data.get("category"):
            validated_data["category"] = event.title[:100]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        event = validated_data.get("event", instance.event)
        if event and "category" not in validated_data:
            validated_data["category"] = event.title[:100]
        return super().update(instance, validated_data)


class PartnerSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("logo",)

    class Meta:
        model = Partner
        fields = [
            "id",
            "name",
            "logo",
            "website_url",
            "order",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TestimonialSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("avatar",)
    source_review_id = serializers.SerializerMethodField()

    class Meta:
        model = Testimonial
        fields = [
            "id",
            "name",
            "role",
            "organization",
            "content",
            "avatar",
            "rating",
            "is_featured",
            "is_published",
            "order",
            "source_review_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "source_review_id", "created_at", "updated_at"]

    def get_source_review_id(self, obj):
        review = getattr(obj, "course_review", None)
        return review.id if review else None


class CourseReviewSerializer(serializers.ModelSerializer):
    testimonial_id = serializers.IntegerField(read_only=True, allow_null=True)
    is_promoted = serializers.SerializerMethodField()

    class Meta:
        model = CourseReview
        fields = [
            "id",
            "user",
            "student_name",
            "student_email",
            "course_name",
            "rating",
            "content",
            "status",
            "testimonial_id",
            "is_promoted",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "testimonial_id", "is_promoted", "created_at", "updated_at"]

    def get_is_promoted(self, obj):
        return obj.testimonial_id is not None


class CourseReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseReview
        fields = ["student_name", "student_email", "course_name", "rating", "content"]


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = [
            "id",
            "question",
            "answer",
            "category",
            "order",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = [
            "id",
            "title",
            "slug",
            "department",
            "location",
            "employment_type",
            "description",
            "requirements",
            "is_active",
            "is_published",
            "posted_at",
            "closes_at",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "content",
            "priority",
            "audience",
            "is_published",
            "starts_at",
            "ends_at",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ContactMessageSerializer(serializers.ModelSerializer):
    # Client-only; verified server-side then discarded (never stored).
    recaptcha_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        default="",
    )

    class Meta:
        model = ContactMessage
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "subject",
            "message",
            "status",
            "is_read",
            "replied_at",
            "created_at",
            "updated_at",
            "recaptcha_token",
        ]
        read_only_fields = [
            "id",
            "status",
            "is_read",
            "replied_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        from apps.common.recaptcha import require_recaptcha

        # Public creates only — admin updates must not require a widget token.
        if self.instance is None:
            require_recaptcha(attrs, self.context.get("request"))
        else:
            attrs.pop("recaptcha_token", None)
        return attrs


class ContactMessageAdminSerializer(ContactMessageSerializer):
    class Meta(ContactMessageSerializer.Meta):
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        # Staff/admin writes never go through the public reCAPTCHA widget.
        attrs.pop("recaptcha_token", None)
        return attrs

    def update(self, instance, validated_data):
        status = validated_data.pop("status", None)
        instance = super().update(instance, validated_data)
        if status is not None:
            instance.apply_status(status)
            instance.save()
        return instance


class EventRegistrationSerializer(serializers.ModelSerializer):
    """Public create payload."""

    event_slug = serializers.SlugField(write_only=True)
    recaptcha_token = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        default="",
    )

    class Meta:
        model = EventRegistration
        fields = [
            "id",
            "event_slug",
            "name",
            "email",
            "phone",
            "message",
            "status",
            "created_at",
            "recaptcha_token",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        from apps.common.recaptcha import require_recaptcha

        require_recaptcha(attrs, self.context.get("request"))
        return attrs

    def create(self, validated_data):
        slug = validated_data.pop("event_slug")
        event = Event.objects.filter(slug=slug, is_published=True).first()
        if event is None:
            raise serializers.ValidationError({"event_slug": "Event not found."})
        email = validated_data.pop("email").strip().lower()
        if EventRegistration.objects.filter(event=event, email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "You are already registered for this event."}
            )
        return EventRegistration.objects.create(
            event=event,
            email=email,
            **validated_data,
        )


class EventRegistrationAdminSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_slug = serializers.CharField(source="event.slug", read_only=True)
    event_location = serializers.CharField(source="event.location", read_only=True)
    event_start_datetime = serializers.DateTimeField(
        source="event.start_datetime", read_only=True
    )

    class Meta:
        model = EventRegistration
        fields = [
            "id",
            "event",
            "event_title",
            "event_slug",
            "event_location",
            "event_start_datetime",
            "name",
            "email",
            "phone",
            "message",
            "status",
            "approved_at",
            "details_emailed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "event",
            "event_title",
            "event_slug",
            "event_location",
            "event_start_datetime",
            "approved_at",
            "details_emailed_at",
            "created_at",
            "updated_at",
        ]


class CMSTeacherHighlightSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    teacher_id_code = serializers.CharField(source="teacher.teacher_id", read_only=True)
    designation = serializers.CharField(source="teacher.designation", read_only=True)
    department = serializers.CharField(source="teacher.department", read_only=True)
    bio = serializers.CharField(source="teacher.bio", read_only=True)

    class Meta:
        model = CMSTeacherHighlight
        fields = [
            "id",
            "teacher",
            "teacher_name",
            "teacher_id_code",
            "designation",
            "department",
            "bio",
            "order",
            "is_featured",
            "is_published",
            "blurb",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_teacher_name(self, obj):
        user = getattr(obj.teacher, "user", None)
        if user is None:
            return ""
        return user.get_full_name()

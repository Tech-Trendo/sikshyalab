"""Serializers for the CMS module."""

from django.utils.text import slugify
from rest_framework import serializers

from apps.cms.models import (
    Announcement,
    Banner,
    BlogPost,
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
from apps.common.serializers_media import SafeMediaRepresentationMixin
from apps.courses.models import Course


class SiteSettingSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("logo", "favicon")

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
            "social_links",
            "footer_text",
            "features_eyebrow",
            "features_heading",
            "homepage_features",
            "testimonials_eyebrow",
            "testimonials_heading",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


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


class BlogPostSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("cover_image",)
    author_name = serializers.SerializerMethodField()
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=270, validators=[])

    class Meta:
        model = BlogPost
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "content",
            "author",
            "author_name",
            "cover_image",
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


class EventSerializer(SafeMediaRepresentationMixin, serializers.ModelSerializer):
    safe_media_fields = ("cover_image",)
    course_title = serializers.CharField(source="course.title", read_only=True)
    course_slug = serializers.CharField(source="course.slug", read_only=True)

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
            "is_published",
            "registration_url",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "course": {"queryset": Course.objects.all(), "required": False, "allow_null": True},
        }


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
        ]
        read_only_fields = [
            "id",
            "status",
            "is_read",
            "replied_at",
            "created_at",
            "updated_at",
        ]


class ContactMessageAdminSerializer(ContactMessageSerializer):
    class Meta(ContactMessageSerializer.Meta):
        read_only_fields = ["id", "created_at", "updated_at"]

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
        ]
        read_only_fields = ["id", "status", "created_at"]

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

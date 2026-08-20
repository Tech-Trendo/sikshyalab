from django.contrib import admin

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


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = (
        "site_name",
        "contact_email",
        "contact_phone",
        "latitude",
        "longitude",
        "is_published",
    )
    search_fields = ("site_name", "contact_email", "tagline", "address")
    fieldsets = (
        (None, {"fields": ("site_name", "tagline", "logo", "favicon", "is_published")}),
        (
            "Contact",
            {
                "fields": (
                    "contact_email",
                    "contact_phone",
                    "address",
                    "latitude",
                    "longitude",
                ),
                "description": "Latitude/longitude power the Contact page map. Leave blank to hide the map.",
            },
        ),
        ("Social & footer", {"fields": ("social_links", "footer_text")}),
        (
            "SEO / Open Graph",
            {
                "fields": (
                    "google_search_console_verification",
                    "og_title",
                    "og_description",
                    "og_image",
                ),
                "description": (
                    "Paste only the verification token from Google "
                    "(e.g. AUeQdOo…), not the full google-site-verification=… string. "
                    "OG fields power social previews; leave blank to use the site name, tagline, and logo."
                ),
            },
        ),
        (
            "Homepage sections",
            {
                "fields": (
                    "features_eyebrow",
                    "features_heading",
                    "homepage_features",
                    "testimonials_eyebrow",
                    "testimonials_heading",
                ),
            },
        ),
    )


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "placement",
        "order",
        "is_active",
        "is_published",
        "start_date",
        "end_date",
    )
    list_filter = ("placement", "is_active", "is_published")
    search_fields = ("title", "subtitle")
    ordering = ("order",)


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "page_type", "is_published", "order")
    list_filter = ("page_type", "is_published")
    search_fields = ("title", "slug", "content")
    prepopulated_fields = {"slug": ("title",)}


class BlogSectionInline(admin.StackedInline):
    model = BlogSection
    extra = 0
    fields = ("title", "description", "image", "order")
    ordering = ("order", "created_at")


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "author",
        "category",
        "is_published",
        "published_at",
        "views_count",
    )
    list_filter = ("is_published", "category")
    search_fields = ("title", "slug", "excerpt", "content")
    prepopulated_fields = {"slug": ("title",)}
    raw_id_fields = ("author",)
    date_hierarchy = "published_at"
    inlines = [BlogSectionInline]
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "slug",
                    "excerpt",
                    "content",
                    "author",
                    "cover_image",
                    "category",
                    "tags",
                    "is_published",
                    "published_at",
                    "views_count",
                    "order",
                )
            },
        ),
        (
            "SEO / Open Graph",
            {
                "fields": (
                    "meta_title",
                    "meta_description",
                    "og_title",
                    "og_description",
                    "og_image",
                ),
                "description": (
                    "OG title recommended 60 characters. OG description recommended 160. "
                    "OG image recommended 1200×630px. Blank OG fields fall back to title, excerpt, and cover image."
                ),
            },
        ),
    )


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "location",
        "start_datetime",
        "end_datetime",
        "is_published",
    )
    list_filter = ("is_published",)
    search_fields = ("title", "slug", "location", "description")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "start_datetime"
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "slug",
                    "description",
                    "location",
                    "course",
                    "start_datetime",
                    "end_datetime",
                    "cover_image",
                    "is_published",
                    "registration_url",
                    "order",
                )
            },
        ),
        (
            "SEO / Open Graph",
            {
                "fields": (
                    "meta_title",
                    "meta_description",
                    "og_title",
                    "og_description",
                    "og_image",
                ),
                "description": (
                    "OG title recommended 60 characters. OG description recommended 160. "
                    "OG image recommended 1200×630px. Blank OG fields fall back to title, description, and cover image."
                ),
            },
        ),
    )


@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "email",
        "event",
        "status",
        "phone",
        "approved_at",
        "details_emailed_at",
        "created_at",
    )
    list_filter = ("status", "event")
    search_fields = ("name", "email", "phone", "message", "event__title")
    readonly_fields = ("approved_at", "details_emailed_at", "created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(GalleryItem)
class GalleryItemAdmin(admin.ModelAdmin):
    list_display = ("title", "event", "category", "order", "is_published")
    list_filter = ("is_published", "event")
    search_fields = ("title", "category", "event__title")
    raw_id_fields = ("event",)
    ordering = ("order",)


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = ("name", "order", "is_published", "created_at")
    list_filter = ("is_published",)
    search_fields = ("name",)
    ordering = ("order",)


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "role",
        "organization",
        "rating",
        "is_featured",
        "is_published",
        "order",
    )
    list_filter = ("is_featured", "is_published", "rating")
    search_fields = ("name", "role", "organization", "content")


@admin.register(CourseReview)
class CourseReviewAdmin(admin.ModelAdmin):
    list_display = ("student_name", "course_name", "rating", "status", "testimonial", "created_at")
    list_filter = ("status", "rating")
    search_fields = ("student_name", "student_email", "course_name", "content")
    raw_id_fields = ("user", "testimonial")


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question", "category", "order", "is_published")
    list_filter = ("category", "is_published")
    search_fields = ("question", "answer", "category")
    ordering = ("order",)


@admin.register(Career)
class CareerAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "department",
        "location",
        "employment_type",
        "is_active",
        "is_published",
        "posted_at",
        "closes_at",
    )
    list_filter = ("employment_type", "is_active", "is_published", "department")
    search_fields = ("title", "slug", "description", "requirements")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "posted_at"


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "priority",
        "audience",
        "is_published",
        "starts_at",
        "ends_at",
    )
    list_filter = ("priority", "audience", "is_published")
    search_fields = ("title", "content")


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = (
        "subject",
        "name",
        "email",
        "status",
        "is_read",
        "replied_at",
        "created_at",
    )
    list_filter = ("status", "is_read")
    search_fields = ("name", "email", "subject", "message")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(CMSTeacherHighlight)
class CMSTeacherHighlightAdmin(admin.ModelAdmin):
    list_display = ("teacher", "order", "is_featured", "is_published")
    list_filter = ("is_featured", "is_published")
    raw_id_fields = ("teacher",)
    ordering = ("order",)

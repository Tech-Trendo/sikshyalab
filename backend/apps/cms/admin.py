from django.contrib import admin

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


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ("site_name", "contact_email", "contact_phone", "is_published")
    search_fields = ("site_name", "contact_email", "tagline")


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

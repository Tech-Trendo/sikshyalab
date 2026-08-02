"""CMS content viewsets (pages, media, listings)."""

from django.db.models import F, Q
from django.utils import timezone
from django_filters import rest_framework as filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.cms.models import (
    Announcement,
    Banner,
    BlogPost,
    Career,
    CMSTeacherHighlight,
    Event,
    FAQ,
    GalleryItem,
    Page,
    Partner,
    SiteSetting,
    Testimonial,
)
from apps.cms.permissions import IsAdminOrStaffWrite
from apps.cms.serializers import (
    AnnouncementSerializer,
    BannerSerializer,
    BlogPostSerializer,
    CareerSerializer,
    CMSTeacherHighlightSerializer,
    EventSerializer,
    FAQSerializer,
    GalleryItemSerializer,
    PageSerializer,
    PartnerSerializer,
    SiteSettingSerializer,
    TestimonialSerializer,
)
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import success_response


class EventFilter(filters.FilterSet):
    """Public course pages pass course_slug to find related events."""

    course_slug = filters.CharFilter(method="filter_course_slug")

    class Meta:
        model = Event
        fields = ["is_published", "location", "course", "course__slug"]

    def filter_course_slug(self, queryset, name, value):
        slug = (value or "").strip()
        if not slug:
            return queryset
        q = Q(course__slug=slug) | Q(slug=slug)
        try:
            from apps.courses.models import Course

            course = Course.objects.filter(slug=slug).only("title").first()
            if course and course.title:
                q |= Q(title__iexact=course.title)
        except Exception:
            pass
        return queryset.filter(q).distinct()


class GalleryItemFilter(filters.FilterSet):
    """
    Course detail gallery uses course_slug.
    Match via event→course, or event slug/title, or legacy category text.
    """

    course_slug = filters.CharFilter(method="filter_course_slug")

    class Meta:
        model = GalleryItem
        fields = [
            "category",
            "is_published",
            "event",
            "event__slug",
            "event__course",
            "event__course__slug",
        ]

    def filter_course_slug(self, queryset, name, value):
        slug = (value or "").strip()
        if not slug:
            return queryset
        q = (
            Q(event__course__slug=slug)
            | Q(event__slug=slug)
            | Q(category__iexact=slug)
        )
        try:
            from apps.courses.models import Course

            course = Course.objects.filter(slug=slug).only("title").first()
            if course and course.title:
                q |= Q(event__title__iexact=course.title) | Q(category__iexact=course.title)
        except Exception:
            pass
        return queryset.filter(q).distinct()


class PublishedPublicMixin:
    """Non-staff users only see published rows; staff see all."""

    published_field = "is_published"

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(**{self.published_field: True})


class SiteSettingViewSet(viewsets.ModelViewSet):
    queryset = SiteSetting.objects.all()
    serializer_class = SiteSettingSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [OrderingFilter]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(is_published=True)

    @action(detail=False, methods=["get"], url_path="current", permission_classes=[AllowAny])
    def current(self, request):
        setting = SiteSetting.get_solo()
        if setting is None:
            return Response(
                {"success": False, "message": "Site settings not configured.", "data": None},
                status=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=SiteSettingSerializer(setting, context={"request": request}).data)


class BannerViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = Banner.objects.all()
    serializer_class = BannerSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["placement", "is_active", "is_published"]
    search_fields = ["title", "subtitle", "cta_text"]
    ordering_fields = ["order", "created_at", "start_date"]
    ordering = ["order"]

    def get_queryset(self):
        from django.db.models import Q

        qs = super().get_queryset()
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        now = timezone.now()
        return qs.filter(is_active=True).filter(
            (Q(start_date__isnull=True) | Q(start_date__lte=now))
            & (Q(end_date__isnull=True) | Q(end_date__gte=now))
        )


class PageViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = Page.objects.all()
    serializer_class = PageSerializer
    permission_classes = [IsAdminOrStaffWrite]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["page_type", "is_published"]
    search_fields = ["title", "slug", "content"]
    ordering_fields = ["order", "title", "created_at"]
    ordering = ["order", "title"]


class BlogPostViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = BlogPost.objects.select_related("author")
    serializer_class = BlogPostSerializer
    permission_classes = [IsAdminOrStaffWrite]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["category", "is_published", "author"]
    search_fields = ["title", "slug", "excerpt", "content", "tags"]
    ordering_fields = ["published_at", "views_count", "created_at", "order"]
    ordering = ["-published_at"]

    def perform_create(self, serializer):
        author = serializer.validated_data.get("author") or self.request.user
        serializer.save(author=author)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        is_staff = user and user.is_authenticated and user_has_role(
            user, ROLE_ADMIN, ROLE_STAFF
        )
        if not is_staff and instance.is_published:
            BlogPost.objects.filter(pk=instance.pk).update(views_count=F("views_count") + 1)
            instance.refresh_from_db(fields=["views_count"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class EventViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = Event.objects.select_related("course").all()
    serializer_class = EventSerializer
    permission_classes = [IsAdminOrStaffWrite]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = EventFilter
    search_fields = ["title", "slug", "description", "location", "course__title"]
    ordering_fields = ["start_datetime", "end_datetime", "order", "created_at"]
    ordering = ["start_datetime"]


class GalleryItemViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = GalleryItem.objects.select_related("event", "event__course").all()
    serializer_class = GalleryItemSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = GalleryItemFilter
    search_fields = ["title", "category", "event__title"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order"]


class PartnerViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = Partner.objects.all()
    serializer_class = PartnerSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_published"]
    search_fields = ["name"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order"]


class TestimonialViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = Testimonial.objects.select_related("course_review").all()
    serializer_class = TestimonialSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_featured", "is_published", "rating"]
    search_fields = ["name", "role", "organization", "content"]
    ordering_fields = ["order", "rating", "created_at"]
    ordering = ["order"]


class FAQViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = FAQ.objects.all()
    serializer_class = FAQSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["category", "is_published"]
    search_fields = ["question", "answer", "category"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order"]


class CareerViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = Career.objects.all()
    serializer_class = CareerSerializer
    permission_classes = [IsAdminOrStaffWrite]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["department", "location", "employment_type", "is_active", "is_published"]
    search_fields = ["title", "slug", "description", "requirements", "department"]
    ordering_fields = ["posted_at", "closes_at", "order", "created_at"]
    ordering = ["-posted_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(is_active=True)


class AnnouncementViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["priority", "audience", "is_published"]
    search_fields = ["title", "content"]
    ordering_fields = ["priority", "starts_at", "created_at", "order"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user and user.is_authenticated and user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        now = timezone.now()
        from django.db.models import Q

        return qs.filter(
            (Q(starts_at__isnull=True) | Q(starts_at__lte=now))
            & (Q(ends_at__isnull=True) | Q(ends_at__gte=now))
        )


class CMSTeacherHighlightViewSet(PublishedPublicMixin, viewsets.ModelViewSet):
    queryset = CMSTeacherHighlight.objects.select_related("teacher", "teacher__user")
    serializer_class = CMSTeacherHighlightSerializer
    permission_classes = [IsAdminOrStaffWrite]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["is_featured", "is_published", "teacher"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order"]


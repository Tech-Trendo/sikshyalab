"""CMS interaction viewsets (reviews, contact, event registrations)."""

from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.emails import send_event_registration_approved_email
from apps.cms.models import ContactMessage, CourseReview, EventRegistration, Testimonial
from apps.cms.permissions import AllowAnyCreateAdminManage, IsAdminOrStaff
from apps.cms.serializers import (
    ContactMessageAdminSerializer,
    ContactMessageSerializer,
    CourseReviewCreateSerializer,
    CourseReviewSerializer,
    EventRegistrationAdminSerializer,
    EventRegistrationSerializer,
    TestimonialSerializer,
)
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import success_response

class CourseReviewViewSet(viewsets.ModelViewSet):
    queryset = CourseReview.objects.select_related("testimonial", "user").all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "course_name", "rating"]
    search_fields = ["student_name", "student_email", "course_name", "content"]
    ordering_fields = ["created_at", "rating", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return CourseReviewCreateSerializer
        return CourseReviewSerializer

    def get_permissions(self):
        if self.action in (
            "update",
            "partial_update",
            "destroy",
            "promote_to_testimonial",
            "export_to_testimonials",
        ):
            return [IsAdminOrStaff()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.none()
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        return qs.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(
            user=user,
            student_name=serializer.validated_data.get("student_name")
            or user.get_full_name()
            or user.email,
            student_email=serializer.validated_data.get("student_email") or user.email,
            status=CourseReview.Status.PENDING,
        )

    @action(detail=True, methods=["post"], url_path="promote-to-testimonial")
    def promote_to_testimonial(self, request, pk=None):
        review = self.get_object()
        if review.testimonial_id:
            return Response(
                {
                    "success": False,
                    "message": "This review is already published as a testimonial.",
                    "data": CourseReviewSerializer(review).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        testimonial = Testimonial.objects.create(
            name=review.student_name,
            role="Graduate",
            organization=review.course_name,
            content=review.content,
            rating=review.rating,
            is_featured=False,
            is_published=True,
        )
        review.testimonial = testimonial
        review.status = CourseReview.Status.APPROVED
        review.save(update_fields=["testimonial", "status", "updated_at"])
        return success_response(
            data={
                "review": CourseReviewSerializer(review).data,
                "testimonial": TestimonialSerializer(testimonial).data,
            },
            message="Review promoted to testimonial.",
        )

    @action(detail=False, methods=["post"], url_path="export-to-testimonials")
    def export_to_testimonials(self, request):
        """Bulk-export approved (or specified) reviews to testimonials."""
        review_ids = request.data.get("review_ids") or []
        only_approved = request.data.get("only_approved", True)

        qs = self.get_queryset().filter(testimonial__isnull=True)
        if review_ids:
            qs = qs.filter(pk__in=review_ids)
        if only_approved:
            qs = qs.filter(status=CourseReview.Status.APPROVED)
        else:
            qs = qs.exclude(status=CourseReview.Status.REJECTED)

        promoted = []
        skipped = []
        for review in qs:
            testimonial = Testimonial.objects.create(
                name=review.student_name,
                role="Graduate",
                organization=review.course_name,
                content=review.content,
                rating=review.rating,
                is_featured=False,
                is_published=True,
            )
            review.testimonial = testimonial
            review.status = CourseReview.Status.APPROVED
            review.save(update_fields=["testimonial", "status", "updated_at"])
            promoted.append(
                {
                    "review": CourseReviewSerializer(review).data,
                    "testimonial": TestimonialSerializer(testimonial).data,
                }
            )

        return success_response(
            data={"count": len(promoted), "promoted": promoted, "skipped": skipped},
            message=f"Exported {len(promoted)} review(s) to testimonials.",
        )


class ContactMessageViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ContactMessage.objects.all()
    permission_classes = [AllowAnyCreateAdminManage]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_read", "status"]
    search_fields = ["name", "email", "subject", "message"]
    ordering_fields = ["created_at", "replied_at", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return ContactMessageSerializer
        return ContactMessageAdminSerializer

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [AllowAnyCreateAdminManage()]

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        message = self.get_object()
        status_value = (request.data.get("status") or "").upper()
        try:
            message.apply_status(status_value)
        except ValueError:
            return Response(
                {"detail": "Invalid status. Use PENDING, CONTACTED, CONVERTED, or LOST."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message.save()
        return success_response(
            data=ContactMessageAdminSerializer(message).data,
            message=f"Status set to {message.status}.",
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.status == ContactMessage.Status.PENDING:
            message.apply_status(ContactMessage.Status.CONTACTED)
            message.save()
        else:
            message.is_read = True
            message.save(update_fields=["is_read", "updated_at"])
        return success_response(
            data=ContactMessageAdminSerializer(message).data,
            message="Message marked as read.",
        )

    @action(detail=True, methods=["post"], url_path="mark-replied")
    def mark_replied(self, request, pk=None):
        message = self.get_object()
        message.apply_status(ContactMessage.Status.CONTACTED)
        message.save()
        return success_response(
            data=ContactMessageAdminSerializer(message).data,
            message="Message marked as contacted.",
        )


class EventRegistrationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = EventRegistration.objects.select_related("event").all()
    permission_classes = [AllowAnyCreateAdminManage]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "event", "event__slug"]
    search_fields = ["name", "email", "phone", "message", "event__title"]
    ordering_fields = ["created_at", "approved_at", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return EventRegistrationSerializer
        return EventRegistrationAdminSerializer

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [AllowAnyCreateAdminManage()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        registration = serializer.save()
        return success_response(
            data=EventRegistrationSerializer(registration).data,
            message="Registration submitted. You will receive details after approval.",
            status_code=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        registration = self.get_object()
        event = registration.event
        emailed = send_event_registration_approved_email(
            email=registration.email,
            name=registration.name,
            event_title=event.title,
            event_location=event.location,
            event_start=event.start_datetime,
            event_end=event.end_datetime,
            event_description=event.description or "",
            event_slug=event.slug,
        )
        registration.status = EventRegistration.Status.APPROVED
        registration.approved_at = timezone.now()
        if emailed:
            registration.details_emailed_at = timezone.now()
        registration.save(
            update_fields=[
                "status",
                "approved_at",
                "details_emailed_at",
                "updated_at",
            ]
        )
        return success_response(
            data=EventRegistrationAdminSerializer(registration).data,
            message=(
                "Registration approved and details emailed."
                if emailed
                else "Registration approved, but email could not be sent."
            ),
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        registration = self.get_object()
        registration.status = EventRegistration.Status.REJECTED
        registration.save(update_fields=["status", "updated_at"])
        return success_response(
            data=EventRegistrationAdminSerializer(registration).data,
            message="Registration rejected.",
        )


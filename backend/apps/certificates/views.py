"""DRF viewsets for certificates."""

from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.certificates.models import (
    Certificate,
    CertificateSettings,
    CertificateTemplate,
    CertificateVerificationLog,
)
from apps.certificates.permissions import (
    IsAdminOrOwnCertificateRead,
    IsAdminOrStaff,
    _get_student_for_user,
)
from apps.certificates.serializers import (
    BulkGenerateCertificateSerializer,
    CertificatePublicSerializer,
    CertificateSerializer,
    CertificateSettingsSerializer,
    CertificateTemplateSerializer,
    CertificateVerificationLogSerializer,
    GenerateCertificateSerializer,
)
from apps.certificates.services import (
    bulk_generate_certificates,
    dashboard_stats,
    generate_certificate_on_completion,
    regenerate_qr as regenerate_qr_service,
    revoke_certificate,
)
from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import created_response, error_response, success_response


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class CertificateTemplateViewSet(viewsets.ModelViewSet):
    queryset = CertificateTemplate.objects.select_related("course")
    serializer_class = CertificateTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["course", "is_active", "is_default", "purpose"]
    search_fields = ["name", "footer_text"]
    ordering_fields = ["name", "created_at", "is_default"]
    ordering = ["-is_default", "name"]


class CertificateViewSet(viewsets.ModelViewSet):
    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwnCertificateRead]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        "student",
        "course",
        "enrollment",
        "batch",
        "status",
        "issued_by",
        "template",
    ]
    search_fields = [
        "certificate_number",
        "verification_code",
        "title",
        "student__user__email",
        "student__user__first_name",
        "student__user__last_name",
        "course__title",
    ]
    ordering_fields = ["issue_date", "completion_date", "created_at", "certificate_number"]
    ordering = ["-issue_date"]

    def get_queryset(self):
        qs = Certificate.objects.select_related(
            "student",
            "student__user",
            "course",
            "enrollment",
            "batch",
            "issued_by",
            "template",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        student = _get_student_for_user(user)
        if student is None:
            return qs.none()
        return qs.filter(student=student)

    def get_permissions(self):
        write_actions = (
            "create",
            "update",
            "partial_update",
            "destroy",
            "generate",
            "generate_bulk",
            "regenerate_qr",
            "regenerate",
            "revoke",
        )
        if self.action in write_actions:
            return [IsAuthenticated(), IsAdminOrStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(issued_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="dashboard-stats")
    def dashboard_stats(self, request):
        return success_response(
            data=dashboard_stats(),
            message="Certificate dashboard stats loaded.",
        )

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        serializer = GenerateCertificateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            certificate = generate_certificate_on_completion(
                student=data["student"],
                course=data["course"],
                enrollment=data.get("enrollment"),
                batch=data.get("batch"),
                issued_by=request.user,
                completion_date=data.get("completion_date"),
                grade_or_score=data.get("grade_or_score") or None,
                title=data.get("title") or None,
                description=data.get("description") or "",
                template=data.get("template"),
                force=data.get("force", False),
                metadata=data.get("metadata") or {},
                certificate_number=data.get("certificate_number") or None,
            )
        except ValueError as exc:
            return error_response(message=str(exc), status_code=400)
        return created_response(
            data=CertificateSerializer(certificate, context={"request": request}).data,
            message="Certificate generated successfully.",
        )

    @action(detail=False, methods=["post"], url_path="generate-bulk")
    def generate_bulk(self, request):
        serializer = BulkGenerateCertificateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        created = bulk_generate_certificates(
            course=data["course"],
            batch=data.get("batch"),
            student_ids=data.get("student_ids"),
            template=data.get("template"),
            issued_by=request.user,
            completion_date=data.get("completion_date"),
            grade_or_score=data.get("grade_or_score") or None,
            force=data.get("force", False),
        )
        payload = CertificateSerializer(
            created, many=True, context={"request": request}
        ).data
        return created_response(
            data={"count": len(created), "certificates": payload},
            message=f"Generated {len(created)} certificate(s).",
        )

    @action(detail=True, methods=["post"], url_path="regenerate-qr")
    def regenerate_qr(self, request, pk=None):
        certificate = self.get_object()
        regenerate_qr_service(certificate)
        certificate.refresh_from_db()
        return success_response(
            data=CertificateSerializer(certificate, context={"request": request}).data,
            message="QR code regenerated.",
        )

    @action(detail=True, methods=["post"], url_path="regenerate")
    def regenerate(self, request, pk=None):
        certificate = self.get_object()
        new_cert = generate_certificate_on_completion(
            student=certificate.student,
            course=certificate.course,
            enrollment=certificate.enrollment,
            batch=certificate.batch,
            issued_by=request.user,
            completion_date=certificate.completion_date,
            grade_or_score=certificate.grade_or_score,
            title=certificate.title,
            description=certificate.description,
            template=certificate.template,
            metadata=certificate.metadata,
            force=True,
        )
        return success_response(
            data=CertificateSerializer(new_cert, context={"request": request}).data,
            message="Certificate regenerated.",
        )

    @action(detail=True, methods=["post"], url_path="revoke")
    def revoke(self, request, pk=None):
        certificate = self.get_object()
        if certificate.status == Certificate.Status.REVOKED:
            return error_response(
                message="Certificate is already revoked.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reason", "")
        revoke_certificate(certificate, reason=reason)
        certificate.refresh_from_db()
        return success_response(
            data=CertificateSerializer(certificate, context={"request": request}).data,
            message="Certificate revoked.",
        )


class CertificateVerificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CertificateVerificationLog.objects.select_related("certificate")
    serializer_class = CertificateVerificationLogSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaff]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["certificate", "is_valid"]
    ordering_fields = ["verified_at"]
    ordering = ["-verified_at"]


class CertificateSettingsAPIView(APIView):
    """Retrieve and update singleton certificate settings."""

    permission_classes = [IsAuthenticated, IsAdminOrStaff]

    def get(self, request):
        settings_obj = CertificateSettings.get_solo()
        return success_response(
            data=CertificateSettingsSerializer(
                settings_obj, context={"request": request}
            ).data,
            message="Certificate settings loaded.",
        )

    def patch(self, request):
        settings_obj = CertificateSettings.get_solo()
        serializer = CertificateSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            data=serializer.data,
            message="Certificate settings updated.",
        )


class CertificateVerifyAPIView(APIView):
    """
    Public certificate verification.

    GET /api/v1/certificates/verify/{verification_code}/
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, verification_code):
        settings_obj = CertificateSettings.get_solo()
        if not settings_obj.allow_public_verification:
            return error_response(
                message="Public verification is disabled.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        certificate = (
            Certificate.objects.select_related("student__user", "course", "batch")
            .filter(
                Q(verification_code__iexact=verification_code)
                | Q(certificate_number__iexact=verification_code)
            )
            .first()
        )
        if certificate is None:
            return error_response(
                message="Certificate not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        is_valid = certificate.is_valid
        CertificateVerificationLog.objects.create(
            certificate=certificate,
            ip_address=_client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:500],
            is_valid=is_valid,
        )

        if not is_valid:
            return error_response(
                message="Certificate is not valid.",
                data=CertificatePublicSerializer(
                    certificate, context={"request": request}
                ).data,
                status_code=status.HTTP_410_GONE,
            )

        return success_response(
            data=CertificatePublicSerializer(
                certificate, context={"request": request}
            ).data,
            message="Certificate verified successfully.",
        )

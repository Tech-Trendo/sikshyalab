"""DRF viewsets for the fees module."""

from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.responses import created_response, error_response, success_response
from apps.fees.models import (
    Discount,
    FeeStructure,
    InstallmentPlan,
    InstallmentSchedule,
    Invoice,
    Payment,
    Receipt,
    Refund,
    Scholarship,
    StudentFee,
    StudentScholarship,
)
from apps.fees.permissions import IsAdminOrFinanceStaff, IsAdminOrOwnStudentFeeRead, _get_student_for_user
from apps.fees.serializers import (
    ApplyScholarshipSerializer,
    DiscountSerializer,
    FeeStructureSerializer,
    InstallmentPlanSerializer,
    InstallmentScheduleSerializer,
    InvoiceSerializer,
    PaymentSerializer,
    ReceiptSerializer,
    RecordPaymentSerializer,
    RefundSerializer,
    ScholarshipSerializer,
    StudentFeeSerializer,
    StudentScholarshipSerializer,
    compute_scholarship_amount,
    create_payment_with_receipt,
)


class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related("course").prefetch_related(
        "installment_plans__schedules"
    )
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinanceStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["course", "is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "total_amount", "created_at", "applicable_from"]
    ordering = ["-created_at"]


class InstallmentPlanViewSet(viewsets.ModelViewSet):
    queryset = InstallmentPlan.objects.select_related("fee_structure").prefetch_related(
        "schedules"
    )
    serializer_class = InstallmentPlanSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinanceStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["fee_structure"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "number_of_installments", "created_at"]
    ordering = ["name"]


class InstallmentScheduleViewSet(viewsets.ModelViewSet):
    queryset = InstallmentSchedule.objects.select_related("plan")
    serializer_class = InstallmentScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinanceStaff]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["plan"]
    ordering_fields = ["sequence", "due_days_from_enrollment", "amount"]
    ordering = ["plan", "sequence"]


class StudentFeeViewSet(viewsets.ModelViewSet):
    serializer_class = StudentFeeSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwnStudentFeeRead]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student", "enrollment", "fee_structure", "course", "status"]
    search_fields = ["notes", "student__user__email"]
    ordering_fields = ["due_date", "total_amount", "paid_amount", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = StudentFee.objects.select_related(
            "student",
            "enrollment",
            "enrollment__batch",
            "fee_structure",
            "course",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        student = _get_student_for_user(user)
        if student is None:
            return qs.none()
        return qs.filter(student=student)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "record_payment", "apply_scholarship"):
            return [IsAuthenticated(), IsAdminOrFinanceStaff()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="record-payment")
    def record_payment(self, request, pk=None):
        student_fee = self.get_object()
        serializer = RecordPaymentSerializer(
            data=request.data,
            context={"student_fee": student_fee},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            payment = create_payment_with_receipt(
                student_fee=student_fee,
                data=serializer.validated_data,
                user=request.user,
            )
        return created_response(
            data=PaymentSerializer(payment).data,
            message="Payment recorded successfully.",
        )

    @action(detail=True, methods=["get"], url_path="payment-history")
    def payment_history(self, request, pk=None):
        student_fee = self.get_object()
        payments = Payment.objects.filter(student_fee=student_fee).select_related(
            "student_fee", "student_fee__student", "student_fee__course",
            "invoice", "received_by",
        ).order_by("-paid_at")
        serializer = PaymentSerializer(payments, many=True)
        return success_response(data=serializer.data)

    @action(detail=True, methods=["post"], url_path="apply-scholarship")
    def apply_scholarship(self, request, pk=None):
        student_fee = self.get_object()
        serializer = ApplyScholarshipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scholarship = serializer.validated_data["scholarship"]
        enrollment = serializer.validated_data.get("enrollment") or student_fee.enrollment
        applied_amount = serializer.validated_data.get("applied_amount")
        if applied_amount is None:
            base = student_fee.total_amount - student_fee.discount_amount
            applied_amount = compute_scholarship_amount(scholarship, base)

        with transaction.atomic():
            student_scholarship, created = StudentScholarship.objects.get_or_create(
                student=student_fee.student,
                scholarship=scholarship,
                enrollment=enrollment,
                defaults={
                    "applied_amount": applied_amount,
                    "approved_by": request.user,
                },
            )
            if not created:
                return error_response(
                    message="Scholarship already applied for this student/enrollment.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            student_fee.scholarship_amount = (
                student_fee.scholarship_amount or 0
            ) + applied_amount
            student_fee.recalculate_amounts(save=True)

        return created_response(
            data={
                "student_fee": StudentFeeSerializer(student_fee).data,
                "student_scholarship": StudentScholarshipSerializer(student_scholarship).data,
            },
            message="Scholarship applied successfully.",
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwnStudentFeeRead]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["student_fee", "status", "issue_date", "due_date"]
    search_fields = ["invoice_number", "notes"]
    ordering_fields = ["issue_date", "due_date", "total_amount", "created_at"]
    ordering = ["-issue_date"]

    def get_queryset(self):
        qs = Invoice.objects.select_related(
            "student_fee",
            "student_fee__student",
            "student_fee__student__user",
            "student_fee__course",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        student = _get_student_for_user(user)
        if student is None:
            return qs.none()
        return qs.filter(student_fee__student=student)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrFinanceStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        from datetime import timedelta

        instance = serializer.save()
        if not instance.issue_date:
            instance.issue_date = timezone.now().date()
        if not instance.due_date:
            instance.due_date = instance.issue_date + timedelta(days=14)
        if instance.status == Invoice.Status.DRAFT:
            instance.status = Invoice.Status.ISSUED
        instance.save()


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwnStudentFeeRead]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        "student_fee",
        "invoice",
        "payment_method",
        "status",
        "received_by",
    ]
    search_fields = ["payment_number", "transaction_id", "receipt_number", "notes"]
    ordering_fields = ["paid_at", "amount", "created_at"]
    ordering = ["-paid_at"]

    def get_queryset(self):
        qs = Payment.objects.select_related(
            "student_fee",
            "student_fee__student",
            "student_fee__course",
            "invoice",
            "received_by",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        student = _get_student_for_user(user)
        if student is None:
            return qs.none()
        return qs.filter(student_fee__student=student)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrFinanceStaff()]
        return super().get_permissions()

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt_detail(self, request, pk=None):
        payment = self.get_object()
        try:
            receipt = payment.receipt
        except Receipt.DoesNotExist:
            return error_response(
                message="No receipt found for this payment.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        student_fee = payment.student_fee
        student = getattr(student_fee, "student", None)
        user = getattr(student, "user", None)
        data = ReceiptSerializer(receipt).data
        data["student_name"] = user.get_full_name() if user else ""
        data["course_name"] = getattr(getattr(student_fee, "course", None), "title", "")
        data["amount"] = str(payment.amount)
        data["payment_method"] = payment.payment_method
        data["payment_number"] = payment.payment_number
        data["paid_at"] = payment.paid_at.isoformat() if payment.paid_at else None
        return success_response(data=data)

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)

    def perform_destroy(self, instance):
        """Soft-delete payments for audit retention; notify admins."""
        from apps.fees.models import FeeAuditLog

        FeeAuditLog.objects.create(
            actor=self.request.user,
            action=FeeAuditLog.Action.DELETE,
            object_type="payment",
            object_id=str(instance.pk),
            previous_value={
                "amount": str(instance.amount),
                "status": instance.status,
                "receipt_number": instance.receipt_number or "",
            },
            new_value={},
            detail="Payment soft-deleted",
        )
        instance.delete()  # BaseModel soft-delete
        try:
            from apps.notifications.services import notify_users
            from django.contrib.auth import get_user_model

            User = get_user_model()
            admins = User.objects.filter(role="ADMIN", is_active=True)
            notify_users(
                admins,
                title="Payment record deleted",
                message=f"Payment {instance.payment_number} was soft-deleted.",
                notification_type="PAYMENT",
                event_code="PAYMENT_DELETED",
                priority="HIGH",
            )
        except Exception:
            pass


class ReceiptViewSet(viewsets.ModelViewSet):
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwnStudentFeeRead]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["payment"]
    search_fields = ["receipt_number", "notes"]
    ordering_fields = ["issued_at", "created_at"]
    ordering = ["-issued_at"]

    def get_queryset(self):
        qs = Receipt.objects.select_related(
            "payment",
            "payment__student_fee",
            "payment__student_fee__student",
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        student = _get_student_for_user(user)
        if student is None:
            return qs.none()
        return qs.filter(payment__student_fee__student=student)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrFinanceStaff()]
        return super().get_permissions()


class ScholarshipViewSet(viewsets.ModelViewSet):
    queryset = Scholarship.objects.all()
    serializer_class = ScholarshipSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinanceStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "discount_type"]
    search_fields = ["name", "code", "description"]
    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]


class StudentScholarshipViewSet(viewsets.ModelViewSet):
    serializer_class = StudentScholarshipSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwnStudentFeeRead]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["student", "scholarship", "enrollment"]
    ordering_fields = ["applied_at", "applied_amount"]
    ordering = ["-applied_at"]

    def get_queryset(self):
        qs = StudentScholarship.objects.select_related(
            "student", "scholarship", "enrollment", "approved_by"
        )
        user = self.request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return qs
        student = _get_student_for_user(user)
        if student is None:
            return qs.none()
        return qs.filter(student=student)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrFinanceStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(approved_by=self.request.user)


class DiscountViewSet(viewsets.ModelViewSet):
    queryset = Discount.objects.all()
    serializer_class = DiscountSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinanceStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "discount_type"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]


class RefundViewSet(viewsets.ModelViewSet):
    queryset = Refund.objects.select_related("payment", "processed_by")
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated, IsAdminOrFinanceStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["payment", "status"]
    search_fields = ["reason", "notes", "payment__payment_number"]
    ordering_fields = ["requested_at", "amount", "processed_at"]
    ordering = ["-requested_at"]

    @action(detail=True, methods=["post"], url_path="process")
    def process_refund(self, request, pk=None):
        refund = self.get_object()
        previous_status = refund.status
        new_status = request.data.get("status", Refund.Status.PROCESSED)
        if new_status not in dict(Refund.Status.choices):
            return error_response(message="Invalid refund status.")
        refund.status = new_status
        refund.processed_by = request.user
        refund.processed_at = timezone.now()
        refund.notes = request.data.get("notes", refund.notes)
        refund.save(
            update_fields=["status", "processed_by", "processed_at", "notes", "updated_at"]
        )
        from apps.fees.models import FeeAuditLog

        FeeAuditLog.objects.create(
            actor=request.user,
            action=FeeAuditLog.Action.STATUS,
            object_type="refund",
            object_id=str(refund.pk),
            previous_value={"status": previous_status},
            new_value={"status": new_status, "notes": refund.notes},
            detail=f"Refund processed → {new_status}",
        )

        if new_status == Refund.Status.PROCESSED:
            payment = refund.payment
            payment.status = Payment.Status.REFUNDED
            payment.save(update_fields=["status", "updated_at"])
            fee = payment.student_fee
            fee.paid_amount = max(fee.paid_amount - refund.amount, 0)
            fee.recalculate_amounts(save=True)
        return success_response(
            data=RefundSerializer(refund).data,
            message="Refund updated.",
        )

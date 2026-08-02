"""Serializers for the fees module."""

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.common.utils import generate_unique_code
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


class InstallmentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstallmentSchedule
        fields = [
            "id",
            "plan",
            "sequence",
            "title",
            "amount",
            "due_days_from_enrollment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class InstallmentPlanSerializer(serializers.ModelSerializer):
    schedules = InstallmentScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = InstallmentPlan
        fields = [
            "id",
            "fee_structure",
            "name",
            "number_of_installments",
            "description",
            "schedules",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "schedules"]


class FeeStructureSerializer(serializers.ModelSerializer):
    installment_plans = InstallmentPlanSerializer(many=True, read_only=True)

    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "course",
            "name",
            "total_amount",
            "description",
            "is_active",
            "applicable_from",
            "applicable_to",
            "installment_plans",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "installment_plans"]


class StudentFeeSerializer(serializers.ModelSerializer):
    course_name = serializers.SerializerMethodField()
    batch_code = serializers.SerializerMethodField()
    student_id_display = serializers.SerializerMethodField()

    class Meta:
        model = StudentFee
        fields = [
            "id",
            "student",
            "enrollment",
            "fee_structure",
            "course",
            "course_name",
            "batch_code",
            "student_id_display",
            "total_amount",
            "discount_amount",
            "scholarship_amount",
            "paid_amount",
            "due_amount",
            "status",
            "due_date",
            "last_payment_date",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "paid_amount",
            "due_amount",
            "status",
            "last_payment_date",
            "course_name",
            "batch_code",
            "student_id_display",
            "created_at",
            "updated_at",
        ]

    def get_course_name(self, obj):
        if obj.course_id and getattr(obj, "course", None):
            return obj.course.title
        return ""

    def get_batch_code(self, obj):
        enrollment = getattr(obj, "enrollment", None)
        if enrollment and getattr(enrollment, "batch", None):
            return enrollment.batch.code or ""
        return ""

    def get_student_id_display(self, obj):
        if obj.student_id and getattr(obj, "student", None):
            return obj.student.student_id or ""
        return ""

    def create(self, validated_data):
        instance = super().create(validated_data)
        instance.recalculate_amounts(save=True)
        return instance

    def update(self, instance, validated_data):
        from apps.fees.models import FeeAuditLog

        previous = {
            "total_amount": str(instance.total_amount),
            "discount_amount": str(instance.discount_amount),
            "scholarship_amount": str(instance.scholarship_amount),
            "due_date": str(instance.due_date) if instance.due_date else None,
            "notes": instance.notes,
            "status": instance.status,
        }
        instance = super().update(instance, validated_data)
        instance.recalculate_amounts(save=True)
        new = {
            "total_amount": str(instance.total_amount),
            "discount_amount": str(instance.discount_amount),
            "scholarship_amount": str(instance.scholarship_amount),
            "due_date": str(instance.due_date) if instance.due_date else None,
            "notes": instance.notes,
            "status": instance.status,
        }
        request = self.context.get("request")
        FeeAuditLog.objects.create(
            actor=getattr(request, "user", None) if request else None,
            action=FeeAuditLog.Action.UPDATE,
            object_type="student_fee",
            object_id=str(instance.pk),
            previous_value=previous,
            new_value=new,
            detail="StudentFee updated",
        )
        return instance


class RecordPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    payment_method = serializers.ChoiceField(choices=Payment.PaymentMethod.choices)
    invoice = serializers.PrimaryKeyRelatedField(
        queryset=Invoice.objects.all(),
        required=False,
        allow_null=True,
    )
    transaction_id = serializers.CharField(required=False, allow_blank=True, max_length=150)
    paid_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    gateway_response = serializers.JSONField(required=False)
    create_receipt = serializers.BooleanField(default=True)

    def validate_invoice(self, invoice):
        student_fee = self.context.get("student_fee")
        if invoice and student_fee and invoice.student_fee_id != student_fee.pk:
            raise serializers.ValidationError("Invoice does not belong to this student fee.")
        return invoice


class ApplyScholarshipSerializer(serializers.Serializer):
    scholarship = serializers.PrimaryKeyRelatedField(queryset=Scholarship.objects.all())
    enrollment = serializers.PrimaryKeyRelatedField(
        queryset=Scholarship.objects.none(),
        required=False,
        allow_null=True,
    )
    applied_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=Decimal("0.00"),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from django.apps import apps as django_apps

        Enrollment = django_apps.get_model("enrollments", "Enrollment")
        self.fields["enrollment"].queryset = Enrollment.objects.all()

    def validate_scholarship(self, scholarship):
        if not scholarship.is_active:
            raise serializers.ValidationError("Scholarship is not active.")
        today = timezone.now().date()
        if scholarship.valid_from and today < scholarship.valid_from:
            raise serializers.ValidationError("Scholarship is not yet valid.")
        if scholarship.valid_to and today > scholarship.valid_to:
            raise serializers.ValidationError("Scholarship has expired.")
        if scholarship.max_students is not None:
            used = scholarship.student_scholarships.count()
            if used >= scholarship.max_students:
                raise serializers.ValidationError("Scholarship student limit reached.")
        return scholarship


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_id_display = serializers.SerializerMethodField()
    course_name = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "student_fee",
            "student_name",
            "student_id_display",
            "course_name",
            "invoice_number",
            "issue_date",
            "due_date",
            "amount",
            "tax_amount",
            "total_amount",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "invoice_number", "created_at", "updated_at"]

    def get_student_name(self, obj):
        student = getattr(getattr(obj, "student_fee", None), "student", None)
        user = getattr(student, "user", None)
        if user:
            return user.get_full_name() or user.email
        return ""

    def get_student_id_display(self, obj):
        student = getattr(getattr(obj, "student_fee", None), "student", None)
        return getattr(student, "student_id", None) or ""

    def get_course_name(self, obj):
        fee = getattr(obj, "student_fee", None)
        if fee and getattr(fee, "course", None):
            return fee.course.title
        return ""


class PaymentSerializer(serializers.ModelSerializer):
    course_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "student_fee",
            "invoice",
            "payment_number",
            "amount",
            "payment_method",
            "transaction_id",
            "paid_at",
            "received_by",
            "status",
            "receipt_number",
            "gateway_response",
            "notes",
            "course_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "payment_number",
            "received_by",
            "course_name",
            "created_at",
            "updated_at",
        ]

    def get_course_name(self, obj):
        fee = getattr(obj, "student_fee", None)
        if fee and getattr(fee, "course", None):
            return fee.course.title
        return ""


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = [
            "id",
            "payment",
            "receipt_number",
            "issued_at",
            "file",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "receipt_number", "created_at", "updated_at"]


class ScholarshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scholarship
        fields = [
            "id",
            "name",
            "code",
            "discount_type",
            "discount_value",
            "max_students",
            "valid_from",
            "valid_to",
            "is_active",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StudentScholarshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentScholarship
        fields = [
            "id",
            "student",
            "scholarship",
            "enrollment",
            "applied_amount",
            "applied_at",
            "approved_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "applied_at",
            "approved_by",
            "created_at",
            "updated_at",
        ]


class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = [
            "id",
            "name",
            "code",
            "discount_type",
            "value",
            "valid_from",
            "valid_to",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = [
            "id",
            "payment",
            "amount",
            "reason",
            "status",
            "requested_at",
            "processed_at",
            "processed_by",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "requested_at",
            "processed_at",
            "processed_by",
            "created_at",
            "updated_at",
        ]


def compute_scholarship_amount(scholarship, base_amount):
    if scholarship.discount_type == Scholarship.DiscountType.PERCENTAGE:
        amount = (base_amount * scholarship.discount_value) / Decimal("100")
    else:
        amount = scholarship.discount_value
    return min(amount, base_amount)


def apply_payment_to_fee(student_fee, payment_amount):
    student_fee.paid_amount = (student_fee.paid_amount or Decimal("0.00")) + payment_amount
    student_fee.recalculate_amounts(save=True)
    return student_fee


def create_payment_with_receipt(*, student_fee, data, user):
    from apps.fees.models import FeeAuditLog

    paid_at = data.get("paid_at") or timezone.now()
    amount = data["amount"]
    if amount <= Decimal("0.00"):
        raise serializers.ValidationError({"amount": "Payment amount must be greater than zero."})

    remaining = student_fee.due_amount or Decimal("0.00")
    if amount > remaining:
        raise serializers.ValidationError(
            {"amount": f"Payment cannot exceed remaining balance ({remaining})."}
        )

    enrollment = getattr(student_fee, "enrollment", None)
    if enrollment is not None:
        status_val = getattr(enrollment, "status", None)
        if status_val and status_val not in ("ACTIVE", "APPROVED", "COMPLETED"):
            raise serializers.ValidationError(
                {"enrollment": "Enrollment must be active to record a payment."}
            )

    previous_status = student_fee.status
    previous_paid = str(student_fee.paid_amount)
    previous_due = str(student_fee.due_amount)

    receipt_number = generate_unique_code("RCP", 10) if data.get("create_receipt", True) else None
    payment = Payment.objects.create(
        student_fee=student_fee,
        invoice=data.get("invoice"),
        amount=amount,
        payment_method=data["payment_method"],
        transaction_id=data.get("transaction_id", ""),
        paid_at=paid_at,
        received_by=user,
        status=Payment.Status.SUCCESS,
        receipt_number=receipt_number,
        gateway_response=data.get("gateway_response") or {},
        notes=data.get("notes", ""),
    )
    apply_payment_to_fee(student_fee, payment.amount)
    student_fee.last_payment_date = paid_at.date() if hasattr(paid_at, "date") else paid_at
    student_fee.save(update_fields=["last_payment_date", "updated_at"])

    if data.get("create_receipt", True):
        Receipt.objects.create(
            payment=payment,
            receipt_number=receipt_number or generate_unique_code("RCP", 10),
            issued_at=paid_at,
        )
    invoice = data.get("invoice")
    if invoice and student_fee.status == StudentFee.Status.PAID:
        invoice.status = Invoice.Status.PAID
        invoice.save(update_fields=["status", "updated_at"])

    FeeAuditLog.objects.create(
        actor=user,
        action=FeeAuditLog.Action.PAYMENT,
        object_type="payment",
        object_id=str(payment.pk),
        previous_value={
            "status": previous_status,
            "paid_amount": previous_paid,
            "due_amount": previous_due,
        },
        new_value={
            "status": student_fee.status,
            "paid_amount": str(student_fee.paid_amount),
            "due_amount": str(student_fee.due_amount),
            "amount": str(payment.amount),
            "receipt_number": payment.receipt_number or "",
        },
        detail=f"Recorded payment {payment.payment_number}",
    )

    # Student notifications (best-effort)
    try:
        from apps.notifications.services import notify_user

        student_user = getattr(getattr(student_fee, "student", None), "user", None)
        if student_user:
            notify_user(
                student_user,
                title="Payment recorded",
                message=(
                    f"We recorded a payment of {payment.amount}. "
                    f"Remaining balance: {student_fee.due_amount}."
                ),
                notification_type="PAYMENT",
                event_code="PAYMENT_RECEIVED",
                priority="HIGH",
                action_url="/dashboard/fees",
                related_object_type="payment",
                related_object_id=payment.pk,
                channels=["EMAIL"],
            )
            if student_fee.status == StudentFee.Status.PAID:
                notify_user(
                    student_user,
                    title="Fee fully paid",
                    message="Your course fee is fully paid. Thank you!",
                    notification_type="PAYMENT",
                    event_code="FEE_PAID",
                    priority="MEDIUM",
                    action_url="/dashboard/fees",
                    related_object_type="student_fee",
                    related_object_id=student_fee.pk,
                )
    except Exception:
        pass

    return payment

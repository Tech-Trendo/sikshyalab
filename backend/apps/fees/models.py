"""
Fee structures, student fees, invoices, payments, scholarships, and refunds.
"""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel
from apps.common.utils import generate_unique_code


class FeeStructure(BaseModel):
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fee_structures",
    )
    name = models.CharField(max_length=200)
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    applicable_from = models.DateField(null=True, blank=True)
    applicable_to = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("fee structure")
        verbose_name_plural = _("fee structures")
        indexes = [
            models.Index(fields=["is_active", "name"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.total_amount})"


class InstallmentPlan(BaseModel):
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.CASCADE,
        related_name="installment_plans",
    )
    name = models.CharField(max_length=200)
    number_of_installments = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
    )
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["fee_structure", "name"]
        verbose_name = _("installment plan")
        verbose_name_plural = _("installment plans")

    def __str__(self):
        return f"{self.name} ({self.number_of_installments} installments)"


class InstallmentSchedule(BaseModel):
    plan = models.ForeignKey(
        InstallmentPlan,
        on_delete=models.CASCADE,
        related_name="schedules",
    )
    sequence = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    due_days_from_enrollment = models.PositiveIntegerField(
        default=0,
        help_text=_("Days after enrollment when this installment is due."),
    )

    class Meta:
        ordering = ["plan", "sequence"]
        verbose_name = _("installment schedule")
        verbose_name_plural = _("installment schedules")
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "sequence"],
                name="unique_installment_plan_sequence",
            ),
        ]

    def __str__(self):
        return f"{self.plan.name} — #{self.sequence} {self.title}"


class StudentFee(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        PARTIAL = "PARTIAL", _("Partial")
        PAID = "PAID", _("Paid")
        OVERDUE = "OVERDUE", _("Overdue")
        WAIVED = "WAIVED", _("Waived")

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="fees",
    )
    enrollment = models.ForeignKey(
        "enrollments.Enrollment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fees",
    )
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.PROTECT,
        related_name="student_fees",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_fees",
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    scholarship_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    due_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    due_date = models.DateField(null=True, blank=True)
    last_payment_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("student fee")
        verbose_name_plural = _("student fees")
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["student", "status"]),
        ]

    def __str__(self):
        return f"Fee {self.id} — {self.student} ({self.status})"

    def recalculate_amounts(self, save=True):
        from django.utils import timezone

        net = self.total_amount - self.discount_amount - self.scholarship_amount
        if net < Decimal("0.00"):
            net = Decimal("0.00")
        self.due_amount = max(net - self.paid_amount, Decimal("0.00"))
        if self.status != self.Status.WAIVED:
            if self.paid_amount <= Decimal("0.00"):
                self.status = self.Status.PENDING
            elif self.due_amount <= Decimal("0.00"):
                self.status = self.Status.PAID
            else:
                self.status = self.Status.PARTIAL
            # Overdue when unpaid balance remains past due date
            if (
                self.due_amount > Decimal("0.00")
                and self.due_date
                and self.due_date < timezone.now().date()
            ):
                self.status = self.Status.OVERDUE
        if save:
            self.save(
                update_fields=[
                    "due_amount",
                    "status",
                    "paid_amount",
                    "discount_amount",
                    "scholarship_amount",
                    "updated_at",
                ]
            )


class Invoice(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Draft")
        ISSUED = "ISSUED", _("Issued")
        PAID = "PAID", _("Paid")
        CANCELLED = "CANCELLED", _("Cancelled")
        OVERDUE = "OVERDUE", _("Overdue")

    student_fee = models.ForeignKey(
        StudentFee,
        on_delete=models.CASCADE,
        related_name="invoices",
    )
    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-issue_date", "-created_at"]
        verbose_name = _("invoice")
        verbose_name_plural = _("invoices")

    def __str__(self):
        return self.invoice_number

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = generate_unique_code("INV", 10)
        if self.total_amount is None or self.total_amount == Decimal("0.00"):
            self.total_amount = (self.amount or Decimal("0.00")) + (
                self.tax_amount or Decimal("0.00")
            )
        super().save(*args, **kwargs)


class Payment(BaseModel):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", _("Cash")
        CARD = "CARD", _("Card")
        BANK_TRANSFER = "BANK_TRANSFER", _("Bank Transfer")
        CHEQUE = "CHEQUE", _("Cheque")
        ESEWA = "ESEWA", _("eSewa")
        KHALTI = "KHALTI", _("Khalti")
        ONLINE = "ONLINE", _("Online")
        OTHER = "OTHER", _("Other")

    class Status(models.TextChoices):
        SUCCESS = "SUCCESS", _("Success")
        PENDING = "PENDING", _("Pending")
        FAILED = "FAILED", _("Failed")
        REFUNDED = "REFUNDED", _("Refunded")

    student_fee = models.ForeignKey(
        StudentFee,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    payment_number = models.CharField(max_length=50, unique=True, db_index=True)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    transaction_id = models.CharField(max_length=150, blank=True, db_index=True)
    paid_at = models.DateTimeField()
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_payments",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUCCESS,
        db_index=True,
    )
    receipt_number = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    gateway_response = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-paid_at", "-created_at"]
        verbose_name = _("payment")
        verbose_name_plural = _("payments")
        indexes = [
            models.Index(fields=["status", "payment_method"]),
        ]

    def __str__(self):
        return f"{self.payment_number} ({self.amount})"

    def save(self, *args, **kwargs):
        if not self.payment_number:
            self.payment_number = generate_unique_code("PAY", 10)
        super().save(*args, **kwargs)


class Receipt(BaseModel):
    payment = models.OneToOneField(
        Payment,
        on_delete=models.CASCADE,
        related_name="receipt",
    )
    receipt_number = models.CharField(max_length=50, unique=True, db_index=True)
    issued_at = models.DateTimeField()
    file = models.FileField(upload_to="receipts/", null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-issued_at"]
        verbose_name = _("receipt")
        verbose_name_plural = _("receipts")

    def __str__(self):
        return self.receipt_number

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = generate_unique_code("RCP", 10)
        super().save(*args, **kwargs)


class Scholarship(BaseModel):
    class DiscountType(models.TextChoices):
        PERCENTAGE = "PERCENTAGE", _("Percentage")
        FIXED = "FIXED", _("Fixed")

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE,
    )
    discount_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    max_students = models.PositiveIntegerField(null=True, blank=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = _("scholarship")
        verbose_name_plural = _("scholarships")

    def __str__(self):
        return f"{self.name} ({self.code})"


class StudentScholarship(BaseModel):
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="scholarships",
    )
    scholarship = models.ForeignKey(
        Scholarship,
        on_delete=models.PROTECT,
        related_name="student_scholarships",
    )
    enrollment = models.ForeignKey(
        "enrollments.Enrollment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scholarships",
    )
    applied_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    applied_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_scholarships",
    )

    class Meta:
        ordering = ["-applied_at"]
        verbose_name = _("student scholarship")
        verbose_name_plural = _("student scholarships")
        constraints = [
            models.UniqueConstraint(
                fields=["student", "scholarship", "enrollment"],
                name="unique_student_scholarship_enrollment",
            ),
        ]

    def __str__(self):
        return f"{self.student} — {self.scholarship.code}"


class Discount(BaseModel):
    class DiscountType(models.TextChoices):
        PERCENTAGE = "PERCENTAGE", _("Percentage")
        FIXED = "FIXED", _("Fixed")

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE,
    )
    value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        verbose_name = _("discount")
        verbose_name_plural = _("discounts")

    def __str__(self):
        return f"{self.name} ({self.code})"


class Refund(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        APPROVED = "APPROVED", _("Approved")
        REJECTED = "REJECTED", _("Rejected")
        PROCESSED = "PROCESSED", _("Processed")

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="refunds",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processed_refunds",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-requested_at"]
        verbose_name = _("refund")
        verbose_name_plural = _("refunds")

    def __str__(self):
        return f"Refund {self.amount} for {self.payment.payment_number}"


class FeeAuditLog(BaseModel):
    """Immutable financial audit trail — never hard-delete payment history."""

    class Action(models.TextChoices):
        CREATE = "CREATE", _("Create")
        UPDATE = "UPDATE", _("Update")
        DELETE = "DELETE", _("Delete")
        PAYMENT = "PAYMENT", _("Payment")
        STATUS = "STATUS", _("Status Change")

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fee_audit_logs",
    )
    action = models.CharField(max_length=20, choices=Action.choices, db_index=True)
    object_type = models.CharField(max_length=64, db_index=True)
    object_id = models.CharField(max_length=64, db_index=True)
    previous_value = models.JSONField(default=dict, blank=True)
    new_value = models.JSONField(default=dict, blank=True)
    detail = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("fee audit log")
        verbose_name_plural = _("fee audit logs")
        indexes = [
            models.Index(fields=["object_type", "object_id", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.action} {self.object_type}:{self.object_id}"

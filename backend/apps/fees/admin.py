from django.contrib import admin

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


class InstallmentScheduleInline(admin.TabularInline):
    model = InstallmentSchedule
    extra = 1


class InstallmentPlanInline(admin.TabularInline):
    model = InstallmentPlan
    extra = 0
    show_change_link = True


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "course",
        "total_amount",
        "is_active",
        "applicable_from",
        "applicable_to",
    )
    list_filter = ("is_active", "course")
    search_fields = ("name", "description")
    raw_id_fields = ("course",)
    inlines = [InstallmentPlanInline]


@admin.register(InstallmentPlan)
class InstallmentPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "fee_structure", "number_of_installments")
    search_fields = ("name", "fee_structure__name")
    raw_id_fields = ("fee_structure",)
    inlines = [InstallmentScheduleInline]


@admin.register(InstallmentSchedule)
class InstallmentScheduleAdmin(admin.ModelAdmin):
    list_display = ("plan", "sequence", "title", "amount", "due_days_from_enrollment")
    list_filter = ("plan",)
    ordering = ("plan", "sequence")


@admin.register(StudentFee)
class StudentFeeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "fee_structure",
        "total_amount",
        "paid_amount",
        "due_amount",
        "status",
        "due_date",
    )
    list_filter = ("status", "course")
    search_fields = ("notes", "student__user__email")
    raw_id_fields = ("student", "enrollment", "fee_structure", "course")
    readonly_fields = ("paid_amount", "due_amount")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "student_fee",
        "issue_date",
        "due_date",
        "total_amount",
        "status",
    )
    list_filter = ("status",)
    search_fields = ("invoice_number", "notes")
    raw_id_fields = ("student_fee",)
    date_hierarchy = "issue_date"


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "payment_number",
        "student_fee",
        "amount",
        "payment_method",
        "status",
        "paid_at",
        "received_by",
    )
    list_filter = ("payment_method", "status")
    search_fields = ("payment_number", "transaction_id", "receipt_number")
    raw_id_fields = ("student_fee", "invoice", "received_by")
    date_hierarchy = "paid_at"


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "payment", "issued_at")
    search_fields = ("receipt_number",)
    raw_id_fields = ("payment",)


@admin.register(Scholarship)
class ScholarshipAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "discount_type",
        "discount_value",
        "is_active",
        "valid_from",
        "valid_to",
    )
    list_filter = ("is_active", "discount_type")
    search_fields = ("name", "code", "description")


@admin.register(StudentScholarship)
class StudentScholarshipAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "scholarship",
        "applied_amount",
        "applied_at",
        "approved_by",
    )
    list_filter = ("scholarship",)
    raw_id_fields = ("student", "scholarship", "enrollment", "approved_by")


@admin.register(Discount)
class DiscountAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "discount_type",
        "value",
        "is_active",
        "valid_from",
        "valid_to",
    )
    list_filter = ("is_active", "discount_type")
    search_fields = ("name", "code")


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = (
        "payment",
        "amount",
        "status",
        "requested_at",
        "processed_at",
        "processed_by",
    )
    list_filter = ("status",)
    search_fields = ("reason", "notes", "payment__payment_number")
    raw_id_fields = ("payment", "processed_by")

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.fees.views import (
    DiscountViewSet,
    FeeStructureViewSet,
    InstallmentPlanViewSet,
    InstallmentScheduleViewSet,
    InvoiceViewSet,
    PaymentViewSet,
    ReceiptViewSet,
    RefundViewSet,
    ScholarshipViewSet,
    StudentFeeViewSet,
    StudentScholarshipViewSet,
)

app_name = "fees"

router = DefaultRouter()
router.register(r"structures", FeeStructureViewSet, basename="fee-structure")
router.register(r"installment-plans", InstallmentPlanViewSet, basename="installment-plan")
router.register(
    r"installment-schedules",
    InstallmentScheduleViewSet,
    basename="installment-schedule",
)
router.register(r"student-fees", StudentFeeViewSet, basename="student-fee")
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"payments", PaymentViewSet, basename="payment")
router.register(r"receipts", ReceiptViewSet, basename="receipt")
router.register(r"scholarships", ScholarshipViewSet, basename="scholarship")
router.register(
    r"student-scholarships",
    StudentScholarshipViewSet,
    basename="student-scholarship",
)
router.register(r"discounts", DiscountViewSet, basename="discount")
router.register(r"refunds", RefundViewSet, basename="refund")

urlpatterns = [
    path("", include(router.urls)),
]

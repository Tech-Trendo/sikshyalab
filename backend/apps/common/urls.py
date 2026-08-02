from django.urls import path

from apps.common.views import PdfExportPublicView, PdfExportView

urlpatterns = [
    path("pdf/", PdfExportView.as_view(), name="export-pdf"),
    path("pdf/public/", PdfExportPublicView.as_view(), name="export-pdf-public"),
]

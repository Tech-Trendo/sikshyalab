"""Shared API views (exports, health helpers)."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse

from apps.common.pdf_export import build_certificate_pdf, build_table_pdf


def _normalize_certificate_payload(cert: dict) -> dict:
    """Accept camelCase (frontend) or snake_case certificate fields."""
    mapping = {
        "studentName": "student_name",
        "courseName": "course_name",
        "certificateNumber": "certificate_number",
        "verificationCode": "verification_code",
        "issueDate": "issue_date",
        "completionDate": "completion_date",
        "instructorName": "instructor_name",
        "batchName": "batch_name",
        "instituteName": "institute_name",
    }
    normalized = dict(cert)
    for camel, snake in mapping.items():
        if camel in normalized and snake not in normalized:
            normalized[snake] = normalized[camel]
    return normalized


def _build_pdf_from_request(data) -> bytes:
    title = str(data.get("title") or "Export")
    headers = data.get("headers") or []
    rows = data.get("rows") or []
    fmt = str(data.get("format") or "report")
    subtitle = data.get("subtitle")

    if fmt == "certificate":
        cert = data.get("certificate") or {}
        if cert:
            return build_certificate_pdf(_normalize_certificate_payload(cert))
        if rows:
            row = rows[0]
            return build_certificate_pdf(
                {
                    "student_name": row[1] if len(row) > 1 else "",
                    "course_name": row[2] if len(row) > 2 else "",
                    "certificate_number": row[0] if len(row) > 0 else "",
                    "verification_code": row[3] if len(row) > 3 else "",
                    "issue_date": row[4] if len(row) > 4 else "",
                }
            )

    return build_table_pdf(title, [str(h) for h in headers], rows, subtitle=subtitle)


class PdfExportView(APIView):
    """
    POST /api/v1/exports/pdf/

    Body:
      {
        "title": "Students report",
        "headers": ["ID", "Name", ...],
        "rows": [["STU-1", "Aarav", ...], ...]
      }

    Returns application/pdf attachment.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        title = str(request.data.get("title") or "Export")
        headers = request.data.get("headers") or []
        rows = request.data.get("rows") or []

        if not isinstance(headers, list) or not isinstance(rows, list):
            return Response(
                {"detail": "headers and rows must be arrays."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Allow anonymous during local demo if JWT not wired on frontend yet
        pdf = _build_pdf_from_request(request.data)
        filename = "".join(c if c.isalnum() or c in "-_" else "-" for c in title.lower()) or "export"
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
        return response


class PdfExportPublicView(APIView):
    """Same as PdfExportView but without auth — for frontend demo until JWT is wired."""

    authentication_classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        title = str(request.data.get("title") or "Export")
        headers = request.data.get("headers") or []
        rows = request.data.get("rows") or []
        if not isinstance(headers, list) or not isinstance(rows, list):
            return Response(
                {"detail": "headers and rows must be arrays."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pdf = _build_pdf_from_request(request.data)
        filename = "".join(c if c.isalnum() or c in "-_" else "-" for c in title.lower()) or "export"
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
        return response

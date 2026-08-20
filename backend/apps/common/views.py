"""Shared API views (exports, health helpers)."""

from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.export_data import resolve_export_table
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


def _build_pdf_from_request(data, *, user=None) -> bytes:
    fmt = str(data.get("format") or "report")
    subtitle = data.get("subtitle")

    if fmt == "certificate":
        cert = data.get("certificate") or {}
        if cert:
            return build_certificate_pdf(_normalize_certificate_payload(cert))
        if data.get("rows"):
            row = data["rows"][0]
            return build_certificate_pdf(
                {
                    "student_name": row[1] if len(row) > 1 else "",
                    "course_name": row[2] if len(row) > 2 else "",
                    "certificate_number": row[0] if len(row) > 0 else "",
                    "verification_code": row[3] if len(row) > 3 else "",
                    "issue_date": row[4] if len(row) > 4 else "",
                }
            )

    entity = str(data.get("entity") or data.get("export_type") or "").strip().lower()
    if user is not None and entity in ("student", "students", "teacher", "teachers"):
        title, headers, rows, empty_message = resolve_export_table(user, data)
    else:
        title = str(data.get("title") or "Export")
        headers = [str(h) for h in (data.get("headers") or [])]
        rows = data.get("rows") or []
        empty_message = None

    return build_table_pdf(title, headers, rows, subtitle=subtitle, empty_message=empty_message)


def _export_filename(title: str) -> str:
    slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in title.lower()) or "export"
    return f"{slug}.pdf"


def _validate_export_payload(data) -> str | None:
    entity = str(data.get("entity") or data.get("export_type") or "").strip().lower()
    if entity in ("student", "students", "teacher", "teachers"):
        return None
    headers = data.get("headers")
    rows = data.get("rows")
    if not isinstance(headers, list) or not isinstance(rows, list):
        return "headers and rows must be arrays."
    return None


class PdfExportView(APIView):
    """
    POST /api/v1/exports/pdf/

    Body (client rows):
      {
        "title": "Students report",
        "headers": ["ID", "Name", ...],
        "rows": [["STU-1", "Aarav", ...], ...]
      }

    Body (server-side DB export):
      { "entity": "students" }  or  { "entity": "teachers" }

    Returns application/pdf attachment.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        error = _validate_export_payload(request.data)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        pdf = _build_pdf_from_request(request.data, user=request.user)
        title = str(request.data.get("title") or "Export")
        entity = str(request.data.get("entity") or request.data.get("export_type") or "").strip().lower()
        if entity in ("student", "students"):
            title = "Students report"
        elif entity in ("teacher", "teachers"):
            title = "Teachers report"

        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{_export_filename(title)}"'
        return response


class PdfExportPublicView(APIView):
    """Same as PdfExportView but without auth — accepts client-supplied rows only."""

    authentication_classes = []
    permission_classes = []

    def post(self, request, *args, **kwargs):
        error = _validate_export_payload(request.data)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        pdf = _build_pdf_from_request(request.data)
        title = str(request.data.get("title") or "Export")
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{_export_filename(title)}"'
        return response

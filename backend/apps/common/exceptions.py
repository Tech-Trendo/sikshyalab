"""
Custom DRF exception handler that wraps errors in the standard envelope.

{
    "success": false,
    "message": "...",
    "data": null,
    "errors": { ... } | [ ... ] | null
}
"""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def _extract_message(exc, response_data):
    """Derive a human-readable top-level message from the exception / data."""
    if isinstance(exc, ValidationError):
        return "Validation failed"
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return "Authentication required"
    if isinstance(exc, (PermissionDenied, DjangoPermissionDenied)):
        return "Permission denied"
    if isinstance(exc, (NotFound, Http404)):
        return "Not found"

    if isinstance(response_data, dict):
        detail = response_data.get("detail")
        if isinstance(detail, str):
            return detail
        if isinstance(detail, list) and detail:
            return str(detail[0])
        # Non-field errors
        non_field = response_data.get("non_field_errors")
        if isinstance(non_field, list) and non_field:
            return str(non_field[0])

    if isinstance(exc, APIException) and hasattr(exc, "detail"):
        detail = exc.detail
        if isinstance(detail, str):
            return detail
        if isinstance(detail, list) and detail:
            return str(detail[0])

    return "An error occurred"


def _normalize_errors(response_data):
    """Return structured errors suitable for the envelope."""
    if response_data is None:
        return None
    if isinstance(response_data, dict):
        # Drop lone "detail" into a consistent shape when it's the only key
        if set(response_data.keys()) == {"detail"}:
            return {"detail": response_data["detail"]}
        return response_data
    if isinstance(response_data, list):
        return response_data
    return {"detail": response_data}


def custom_exception_handler(exc, context):
    """
    Wrap DRF's default handler so every error uses the ShikshaLab envelope.
    """
    # Map Django's native exceptions to DRF equivalents so the default
    # handler can process them.
    if isinstance(exc, Http404):
        exc = NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = PermissionDenied()

    response = drf_exception_handler(exc, context)

    if response is None:
        # Unhandled exception — log and return a generic 500 envelope
        logger.exception(
            "Unhandled exception in %s",
            getattr(context.get("view"), "__class__", type(None)).__name__,
        )
        return Response(
            {
                "success": False,
                "message": "Internal server error",
                "data": None,
                "errors": {"detail": "An unexpected error occurred."},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    message = _extract_message(exc, response.data)
    errors = _normalize_errors(response.data)

    response.data = {
        "success": False,
        "message": message,
        "data": None,
        "errors": errors,
    }
    return response

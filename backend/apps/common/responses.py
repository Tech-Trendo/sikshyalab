"""
Standard API response helpers.

Envelope shape:
    {
        "success": bool,
        "message": str,
        "data": Any | null,
        "errors": Any | null
    }
"""

from rest_framework import status
from rest_framework.response import Response


def success_response(
    data=None,
    message="OK",
    status_code=status.HTTP_200_OK,
    meta=None,
    **extra,
):
    """Return a standardised success Response."""
    payload = {
        "success": True,
        "message": message,
        "data": data,
        "errors": None,
    }
    if meta is not None:
        payload["meta"] = meta
    if extra:
        payload.update(extra)
    return Response(payload, status=status_code)


def error_response(
    message="An error occurred",
    errors=None,
    status_code=status.HTTP_400_BAD_REQUEST,
    data=None,
    **extra,
):
    """Return a standardised error Response."""
    payload = {
        "success": False,
        "message": message,
        "data": data,
        "errors": errors,
    }
    if extra:
        payload.update(extra)
    return Response(payload, status=status_code)


def created_response(data=None, message="Created successfully"):
    return success_response(
        data=data,
        message=message,
        status_code=status.HTTP_201_CREATED,
    )


def no_content_response(message="Deleted successfully"):
    return success_response(
        data=None,
        message=message,
        status_code=status.HTTP_200_OK,
    )

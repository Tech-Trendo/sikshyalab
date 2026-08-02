"""
Request logging middleware for ShikshaLab.
"""

import logging
import time
import uuid

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware:
    """
    Log method, path, status, duration, and a correlation request-id
    for every incoming HTTP request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.request_id = request_id

        start = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - start) * 1000

        user = getattr(request, "user", None)
        user_repr = (
            getattr(user, "pk", None)
            if user is not None and getattr(user, "is_authenticated", False)
            else "anonymous"
        )

        # Skip noisy static/media paths
        path = request.path
        if not (path.startswith("/static/") or path.startswith("/media/")):
            logger.info(
                "request_id=%s method=%s path=%s status=%s duration_ms=%.2f user=%s",
                request_id,
                request.method,
                path,
                response.status_code,
                duration_ms,
                user_repr,
            )

        response["X-Request-ID"] = request_id
        return response

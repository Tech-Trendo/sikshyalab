"""
Rewrite legacy /api/<app>/... requests to /api/v1/<app>/...

Avoids mounting the same URLconf twice (which triggers urls.W005 namespace warnings).
"""


class ApiV1CompatMiddleware:
    """Map /api/cms/... → /api/v1/cms/... before URL resolving."""

    SKIP_PREFIXES = (
        "/api/v1/",
        "/api/schema/",
        "/api/docs/",
        "/api/redoc/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/") and not path.startswith(self.SKIP_PREFIXES):
            # /api/cms/partners/ → /api/v1/cms/partners/
            suffix = path[len("/api/") :]
            rewritten = f"/api/v1/{suffix}"
            request.path_info = rewritten
            # Keep PATH_INFO in sync for Django's resolver
            request.META["PATH_INFO"] = rewritten
        return self.get_response(request)

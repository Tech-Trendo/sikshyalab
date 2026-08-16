"""httpOnly media-session cookie helpers (strict in-app media streaming).

Used ONLY by ``GET /api/v1/content/resources/<id>/stream/``.
Regular API auth remains Authorization: Bearer JWT.
"""

from __future__ import annotations

from django.conf import settings


MEDIA_COOKIE_NAME = getattr(settings, "MEDIA_COOKIE_NAME", "sl_media_session")


def media_cookie_kwargs() -> dict:
    """
    Cookie flags for the media session.

    SameSite tradeoff
    -----------------
    * ``Strict`` — strongest; cookie never sent on cross-site requests. Prefer when
      the SPA and API share the same site (or the SPA proxies ``/api``).
    * ``Lax`` — default; works for schemeful same-site media GETs
      (e.g. ``localhost:5173`` → ``localhost:8000``). Different hosts/IPs are
      cross-site — the cookie will NOT be sent (typical LAN: phone/laptop → API IP).
    * ``None`` — required for true cross-site cookie sends (``app.com`` → ``api.com``
      or ``192.168.x.y:5173`` → ``192.168.x.z:8000``) and MUST use ``Secure=True``
      (HTTPS). Not usable on plain HTTP LAN; prefer same-site proxy or HTTPS.
    """
    samesite = getattr(settings, "MEDIA_COOKIE_SAMESITE", "Lax") or "Lax"
    secure = bool(getattr(settings, "MEDIA_COOKIE_SECURE", not settings.DEBUG))
    if str(samesite).lower() == "none":
        secure = True
    return {
        "key": MEDIA_COOKIE_NAME,
        "httponly": True,
        "secure": secure,
        "samesite": samesite,
        "path": "/",
        "max_age": int(getattr(settings, "MEDIA_COOKIE_MAX_AGE", 60 * 60)),
    }


def set_media_cookie(response, access_token: str) -> None:
    """Attach the media session cookie (JWT access token value, httpOnly)."""
    if not access_token:
        return
    kwargs = media_cookie_kwargs()
    response.set_cookie(value=str(access_token), **kwargs)


def clear_media_cookie(response) -> None:
    kwargs = media_cookie_kwargs()
    response.delete_cookie(
        key=kwargs["key"],
        path=kwargs.get("path", "/"),
        samesite=kwargs.get("samesite"),
    )


def read_media_cookie(request) -> str | None:
    raw = request.COOKIES.get(MEDIA_COOKIE_NAME)
    if not raw:
        return None
    return str(raw).strip() or None

"""Safe, additive collection outcomes; never retain provider bodies or credentials."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlsplit, urlunsplit

# Only internal error codes are shown; exception strings may contain credentials.
ERROR_DETAILS = {
    "timeout": "Source deadline exceeded",
    "http_error": "Source returned an unsuccessful HTTP status",
    "fetch_error": "Public source retrieval failed",
    "dns_error": "Public destination could not be resolved",
    "identity_mismatch": "Source is outside company domains",
    "redirect_loop": "Redirect loop detected",
    "invalid_redirect": "Redirect lacks a valid location",
    "redirect_limit": "Redirect limit exceeded",
    "content_too_large": "Source exceeds byte limit",
    "retention_restricted": "Source restricts retained text",
    "empty_content": "No permitted text extracted",
    "unsafe_url": "Source URL failed safety checks",
    "unsafe_address": "Destination failed public-address checks",
    "unsupported_content": "Unsupported source content type",
}


def safe_target(value: str) -> str:
    """Keep a useful public URL without userinfo, query strings or fragments."""
    try:
        parts = urlsplit(value)
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            return "Invalid or unavailable URL"
        host = parts.hostname
        if ":" in host:
            host = f"[{host}]"
        return urlunsplit((parts.scheme, host, parts.path, "", ""))[:500]
    except ValueError:
        return "Invalid or unavailable URL"


@dataclass(frozen=True)
class CollectionAttempt:
    target: str
    status: Literal["ok", "error", "skipped"]
    detail: str
    documents: int | None = None
    at: datetime = field(default_factory=lambda: datetime.now(UTC))

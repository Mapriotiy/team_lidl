"""URL validation and bounded DNS resolution, independently of HTTP libraries."""

import ipaddress
import re
import socket
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from threading import BoundedSemaphore
from urllib.parse import urlsplit, urlunsplit

from app.collection.models import CollectionFailure

_RESOLVERS = ThreadPoolExecutor(max_workers=4, thread_name_prefix="collection-dns")
_DNS_SLOTS = BoundedSemaphore(4)


def canonical_url(value: str) -> str:
    if any(ord(char) < 33 or ord(char) == 127 for char in value) or "\\" in value:
        raise CollectionFailure("unsafe_url", "URL contains whitespace or control characters")
    try:
        parts = urlsplit(value)
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            raise ValueError("HTTP(S) URL required")
        if parts.username is not None or parts.password is not None:
            raise ValueError("Credentials are forbidden")
        host = parts.hostname.rstrip(".").encode("idna").decode("ascii").lower()
        if host == "linkedin.com" or host.endswith(".linkedin.com"):
            raise CollectionFailure("restricted_source", "LinkedIn is manual validation only")
        port = parts.port
        if port not in {None, 80 if parts.scheme == "http" else 443}:
            raise ValueError("Only standard HTTP(S) ports are permitted")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            if len(host) > 253 or any(
                not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
                for label in host.split(".")
            ):
                raise ValueError("Invalid hostname") from None
        else:
            require_public(str(address))
        authority = f"[{host}]" if ":" in host else host
        return urlunsplit((parts.scheme, authority, parts.path or "/", parts.query, ""))
    except (UnicodeError, ValueError) as exc:
        raise CollectionFailure("unsafe_url", str(exc)) from exc


def canonical_domain(value: str) -> str:
    """Normalize a bare domain; never silently accept a path or credentials."""
    url = canonical_url("https://" + value)
    parts = urlsplit(url)
    if parts.path != "/" or parts.query or "/" in value or "#" in value:
        raise CollectionFailure("invalid_identity", "A bare canonical domain is required")
    assert parts.hostname is not None
    return parts.hostname


def require_public(address: str) -> None:
    ip = ipaddress.ip_address(address)
    if not ip.is_global or ip.is_multicast or ip.is_reserved:
        raise CollectionFailure(
            "unsafe_destination", "Destination must be a public unicast address"
        )
    if isinstance(ip, ipaddress.IPv6Address) and (ip.ipv4_mapped or ip.sixtofour or ip.teredo):
        raise CollectionFailure("unsafe_destination", "IPv6 transition destinations are forbidden")


def resolve_public(host: str, port: int, timeout: float) -> tuple[str, ...]:
    if not _DNS_SLOTS.acquire(blocking=False):
        raise CollectionFailure("dns_busy", "DNS resolver capacity exhausted")

    def resolve() -> tuple[str, ...]:
        try:
            return tuple(
                dict.fromkeys(
                    str(item[4][0])
                    for item in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
                )
            )
        finally:
            _DNS_SLOTS.release()

    future = _RESOLVERS.submit(resolve)
    try:
        addresses = future.result(timeout=timeout)
    except TimeoutError as exc:
        raise CollectionFailure("timeout", "DNS deadline exceeded") from exc
    if not addresses:
        raise CollectionFailure("dns_error", "No destination addresses")
    for address in addresses:
        require_public(address)
    return addresses

"""Direct sockets pin validated DNS answers; no second lookup or environment proxy."""

import http.client
import socket
import ssl
import time
from collections.abc import Callable
from dataclasses import dataclass
from threading import Timer
from urllib.parse import urlsplit

from app.collection.models import CollectionFailure
from app.collection.safety import canonical_url, require_public, resolve_public


@dataclass(frozen=True)
class FetchResponse:
    status: int
    headers: dict[str, str]
    body: bytes


class SafeHTTPTransport:
    def __init__(
        self,
        resolver: Callable[[str, int, float], tuple[str, ...]] = resolve_public,
    ) -> None:
        self.resolver = resolver

    def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse:
        deadline = time.monotonic() + timeout
        parts = urlsplit(canonical_url(url))
        assert parts.hostname is not None
        host = parts.hostname
        port = 443 if parts.scheme == "https" else 80
        addresses = self.resolver(host, port, timeout)
        if not addresses:
            raise CollectionFailure("dns_error", "No destination addresses")
        for address in addresses:
            require_public(address)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise CollectionFailure("timeout", "Retrieval deadline exceeded")
        ip = addresses[0]
        raw = socket.socket(socket.AF_INET6 if ":" in ip else socket.AF_INET, socket.SOCK_STREAM)
        active = [raw]

        def expire() -> None:
            try:
                active[0].shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            active[0].close()

        timer = Timer(remaining, expire)
        timer.daemon = True
        timer.start()
        connection = http.client.HTTPConnection(host, port, timeout=remaining)
        try:
            raw.settimeout(remaining)
            raw.connect((ip, port))
            if parts.scheme == "https":
                # Disable automatic handshake until watchdog owns the wrapped socket.
                wrapped = ssl.create_default_context().wrap_socket(
                    raw,
                    server_hostname=host,
                    do_handshake_on_connect=False,
                )
                active[0] = wrapped
                wrapped.do_handshake()
            connection.sock = active[0]
            connection.request(
                "GET",
                parts.path + ("?" + parts.query if parts.query else ""),
                headers={
                    "Host": parts.netloc,
                    "Accept": "text/html, text/plain",
                    "Accept-Encoding": "identity",
                    "Connection": "close",
                    "User-Agent": "PublicSourceResearch/1.0",
                },
            )
            response = connection.getresponse()
            headers = {key.lower(): value for key, value in response.getheaders()}
            if response.status in {301, 302, 303, 307, 308}:
                return FetchResponse(response.status, headers, b"")
            if headers.get("content-encoding", "identity").lower() != "identity":
                raise CollectionFailure("unsupported_encoding", "Compressed content is unsupported")
            length = headers.get("content-length")
            if length is not None:
                try:
                    if int(length) < 0 or int(length) > max_bytes:
                        raise CollectionFailure("content_too_large", "Source exceeds byte limit")
                except ValueError as exc:
                    raise CollectionFailure("invalid_response", "Invalid Content-Length") from exc
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise CollectionFailure("content_too_large", "Source exceeds byte limit")
            if time.monotonic() >= deadline:
                raise CollectionFailure("timeout", "Retrieval deadline exceeded")
            return FetchResponse(response.status, headers, body)
        finally:
            timer.cancel()
            connection.close()
            active[0].close()

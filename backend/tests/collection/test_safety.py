import socket
from unittest.mock import MagicMock

import pytest

from app.collection.models import CollectionFailure
from app.collection.safety import canonical_domain, canonical_url, resolve_public
from app.collection.transport import SafeHTTPTransport


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://127.0.0.1/",
        "https://[::1]/",
        "http://169.254.169.254/",
        "http://10.0.0.1/",
        "http://224.0.0.1/",
        "https://user:password@example.com/",
        "https://example.com:8443/",
        "https://linkedin.com/",
        "https://www.linkedin.com./",
        "https://example.com/\r\nHost:evil.com",
        "https://example.com\\@evil.com/",
        "http://[::ffff:127.0.0.1]/",
        "http://[2002:0808:0808::1]/",
    ],
)
def test_reject_unsafe_urls(url: str) -> None:
    with pytest.raises(CollectionFailure):
        canonical_url(url)


def test_canonical_identity_and_url() -> None:
    assert canonical_domain("EXAMPLE.com.") == "example.com"
    assert canonical_url("https://EXAMPLE.com:443/a?q=1#fragment") == "https://example.com/a?q=1"
    with pytest.raises(CollectionFailure):
        canonical_domain("example.com/path")


def test_reject_mixed_public_private_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    lookup = MagicMock(
        return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443)),
        ]
    )
    monkeypatch.setattr(socket, "getaddrinfo", lookup)
    with pytest.raises(CollectionFailure, match="public unicast"):
        resolve_public("example.com", 443, 1)


def test_transport_pins_ip_and_preserves_host(monkeypatch: pytest.MonkeyPatch) -> None:
    raw = MagicMock()
    monkeypatch.setattr(socket, "socket", MagicMock(return_value=raw))
    connection = MagicMock()
    response = connection.getresponse.return_value
    response.status = 200
    response.getheaders.return_value = [("Content-Type", "text/plain")]
    response.read.return_value = b"public information"
    factory = MagicMock(return_value=connection)
    monkeypatch.setattr("app.collection.transport.http.client.HTTPConnection", factory)
    dns = MagicMock(side_effect=AssertionError("Unexpected second DNS lookup"))
    monkeypatch.setattr(socket, "getaddrinfo", dns)
    transport = SafeHTTPTransport(resolver=lambda host, port, timeout: ("8.8.8.8",))
    result = transport.fetch("http://example.com/a", timeout=2, max_bytes=100)
    assert result.body == b"public information"
    raw.connect.assert_called_once_with(("8.8.8.8", 80))
    assert connection.sock is raw
    assert connection.request.call_args.kwargs["headers"]["Host"] == "example.com"
    dns.assert_not_called()


def test_transport_revalidates_injected_resolver() -> None:
    transport = SafeHTTPTransport(resolver=lambda host, port, timeout: ("127.0.0.1",))
    with pytest.raises(CollectionFailure):
        transport.fetch("https://example.com", timeout=1, max_bytes=100)


def test_unicode_request_targets_are_ascii_without_double_encoding() -> None:
    result = canonical_url("https://example.com/über/%2F?q=новости&next=/résumé#title")
    assert result == (
        "https://example.com/%C3%BCber/%2F?"
        "q=%D0%BD%D0%BE%D0%B2%D0%BE%D1%81%D1%82%D0%B8&next=/r%C3%A9sum%C3%A9"
    )
    assert canonical_url(result) == result
    assert result.isascii()

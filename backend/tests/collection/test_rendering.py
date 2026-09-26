import http.server
import socketserver
import threading
from collections.abc import Iterator

import pytest

from app.collection import CanonicalCompany, PublicSourceCollector, SourceTarget
from app.collection.models import CollectionFailure
from app.collection.rendering import BrowserRenderingTransport, RenderLimits, needs_rendering
from app.collection.transport import FetchResponse

HTML = {"content-type": "text/html; charset=utf-8"}
JS = {"content-type": "application/javascript"}
SHELL = (
    b"<html><head><title>Example shell</title></head>"
    b'<body><div id="root"></div><img src="/logo.png"><script src="/app.js"></script>'
    b"</body></html>"
)
APP_JS = (
    b'document.getElementById("root").textContent = "Rendered by JavaScript. ";'
    b'fetch("/api/facts").then(r => r.text()).then(t => {'
    b'  document.getElementById("root").textContent += t; });'
)
STATIC = (
    b"<html><head><title>Static</title></head><body><p>"
    + b"Plain static company text. " * 20
    + b'</p><script src="/analytics.js"></script></body></html>'
)


class SavedTransport:
    def __init__(self, responses: dict[str, FetchResponse | Exception]) -> None:
        self.responses = responses
        self.calls: list[str] = []

    def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse:
        assert timeout > 0
        self.calls.append(url)
        response = self.responses.get(url)
        if response is None:
            raise CollectionFailure("dns_error", "No destination addresses")
        if isinstance(response, Exception):
            raise response
        return response


def _chromium_available() -> bool:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False
    try:
        with sync_playwright() as playwright:
            playwright.chromium.launch(headless=True).close()
    except Exception:
        return False
    return True


requires_browser = pytest.mark.skipif(
    not _chromium_available(), reason="Playwright Chromium is not installed"
)


@pytest.fixture
def rendering() -> Iterator[tuple[SavedTransport, BrowserRenderingTransport]]:
    transport = SavedTransport(
        {
            "https://example.com/": FetchResponse(200, HTML, SHELL),
            "https://example.com/app.js": FetchResponse(302, {"location": "/static/app.js"}, b""),
            "https://example.com/static/app.js": FetchResponse(200, JS, APP_JS),
            "https://example.com/api/facts": FetchResponse(
                200, {"content-type": "text/plain"}, b"Facts loaded from the API."
            ),
            "https://example.com/logo.png": FetchResponse(200, {"content-type": "image/png"}, b""),
        }
    )
    browser = BrowserRenderingTransport(transport, min_text_chars=100)
    try:
        yield transport, browser
    finally:
        browser.close()


def test_static_pages_are_detected_without_rendering() -> None:
    assert not needs_rendering(STATIC, "text/html")
    assert needs_rendering(SHELL, "text/html")
    assert not needs_rendering(b"<html><body></body></html>", "text/html")
    assert not needs_rendering(b"%PDF-1.4", "application/pdf")


def test_static_pages_pass_through_without_a_browser() -> None:
    transport = SavedTransport({"https://example.com/": FetchResponse(200, HTML, STATIC)})
    browser = BrowserRenderingTransport(transport)
    try:
        response = browser.fetch("https://example.com/", timeout=5, max_bytes=100_000)
    finally:
        browser.close()
    assert response.body == STATIC
    assert transport.calls == ["https://example.com/"]


def test_non_success_responses_pass_through() -> None:
    transport = SavedTransport(
        {"https://example.com/": FetchResponse(302, {"location": "/home"}, b"")}
    )
    browser = BrowserRenderingTransport(transport)
    try:
        response = browser.fetch("https://example.com/", timeout=5, max_bytes=100_000)
    finally:
        browser.close()
    assert response.status == 302


@requires_browser
def test_renders_javascript_shell_through_validated_transport(
    rendering: tuple[SavedTransport, BrowserRenderingTransport],
) -> None:
    transport, browser = rendering
    response = browser.fetch("https://example.com/", timeout=20, max_bytes=1_000_000)
    assert response.status == 200
    assert b"Rendered by JavaScript. Facts loaded from the API." in response.body
    assert "https://example.com/static/app.js" in transport.calls
    assert "https://example.com/api/facts" in transport.calls
    assert "https://example.com/logo.png" not in transport.calls


@requires_browser
def test_collector_extracts_rendered_text(
    rendering: tuple[SavedTransport, BrowserRenderingTransport],
) -> None:
    _, browser = rendering
    result = PublicSourceCollector(browser, timeout=20).collect(
        CanonicalCompany("company-1", "example.com"), [SourceTarget("https://example.com/")]
    )
    assert not result.errors
    assert len(result.documents) == 1
    assert result.documents[0].title == "Example shell"
    assert result.documents[0].normalized_text == (
        "Rendered by JavaScript. Facts loaded from the API."
    )


@requires_browser
def test_request_budget_bounds_page_subresources() -> None:
    page = b'<html><body><div id="root"></div>' + b"".join(
        b'<script src="/s%d.js"></script>' % index for index in range(6)
    )
    responses: dict[str, FetchResponse | Exception] = {
        "https://example.com/": FetchResponse(200, HTML, page + b"</body></html>")
    }
    for index in range(6):
        responses[f"https://example.com/s{index}.js"] = FetchResponse(
            200, JS, b'document.getElementById("root").textContent += "%d ";' % index
        )
    transport = SavedTransport(responses)
    browser = BrowserRenderingTransport(transport, limits=RenderLimits(max_requests=3))
    try:
        response = browser.fetch("https://example.com/", timeout=20, max_bytes=1_000_000)
    finally:
        browser.close()
    assert len(transport.calls) == 4
    assert b"0 1 2 " in response.body and b"3 " not in response.body


@requires_browser
def test_page_scripts_cannot_reach_the_network_directly() -> None:
    class Handler(http.server.BaseHTTPRequestHandler):
        hits = 0

        def do_GET(self) -> None:
            Handler.hits += 1
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", "6")
            self.end_headers()
            self.wfile.write(b"secret")

        def log_message(self, *args: object) -> None:
            pass

    server = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    script = (
        b'const root = document.getElementById("root");'
        b'const attempts = ["http://127.0.0.1:%d/", "http://localhost:%d/",'
        b' "http://example.org/"];'
        % (port, port)
        + b"Promise.all(attempts.map(u => fetch(u).then(r => r.text()).catch(() => 'blocked')))"
        b'.then(v => { root.textContent = "Outcome " + v.join(","); });'
    )
    transport = SavedTransport(
        {
            "https://example.com/": FetchResponse(200, HTML, SHELL),
            "https://example.com/app.js": FetchResponse(200, JS, script),
        }
    )
    browser = BrowserRenderingTransport(transport, min_text_chars=100)
    try:
        response = browser.fetch("https://example.com/", timeout=20, max_bytes=1_000_000)
    finally:
        browser.close()
        server.shutdown()
    assert b"Outcome blocked,blocked,blocked" in response.body
    assert Handler.hits == 0
    assert all(url.startswith("https://example.com/") for url in transport.calls)


@requires_browser
def test_oversized_rendered_pages_are_rejected(
    rendering: tuple[SavedTransport, BrowserRenderingTransport],
) -> None:
    _, browser = rendering
    with pytest.raises(CollectionFailure) as info:
        browser.fetch("https://example.com/", timeout=20, max_bytes=len(SHELL) + 10)
    assert info.value.code == "content_too_large"

"""Headless rendering for JavaScript-driven pages; the browser itself never reaches the network.

Every request the page makes is intercepted and served through the same validated HTTP
transport as static collection, so DNS, public-address, redirect, size and deadline
rules apply to scripts and API calls exactly as they apply to the document.
"""

import logging
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol
from urllib.parse import urljoin

from app.collection.extraction import extract
from app.collection.models import CollectionFailure
from app.collection.safety import canonical_url
from app.collection.transport import FetchResponse, SafeHTTPTransport

if TYPE_CHECKING:
    from playwright.sync_api import Browser, Playwright, Request, Route

logger = logging.getLogger(__name__)

_ALLOWED_RESOURCES = frozenset({"document", "script", "xhr", "fetch"})
_FORWARDED_HEADERS = frozenset({"content-type", "access-control-allow-origin"})
_REDIRECTS = frozenset({301, 302, 303, 307, 308})
_SHELL_MARKERS = (
    b'id="root"',
    b'id="app"',
    b'id="__next"',
    b'id="__nuxt"',
    b"ng-app",
    b"data-reactroot",
    b"enable javascript",
    b"requires javascript",
)


class Transport(Protocol):
    def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse: ...


@dataclass(frozen=True)
class RenderLimits:
    max_requests: int = 40
    max_resource_bytes: int = 2_000_000
    max_total_bytes: int = 12_000_000
    max_redirects: int = 4
    idle_wait_seconds: float = 2


def needs_rendering(body: bytes, content_type: str, *, min_text_chars: int = 200) -> bool:
    """A page is a candidate when static HTML yields little text but ships scripts."""
    if "html" not in content_type.split(";", 1)[0].lower():
        return False
    try:
        extracted = extract(body, content_type)
    except CollectionFailure:
        return False
    if len(extracted.text) >= min_text_chars:
        return False
    head = body[:200_000].lower()
    if b"<script" not in head:
        return False
    return len(extracted.text) < min_text_chars // 2 or any(m in head for m in _SHELL_MARKERS)


class _RequestBudget:
    def __init__(self, limits: RenderLimits) -> None:
        self.limits = limits
        self.requests = 0
        self.bytes = 0

    def admit(self) -> bool:
        if self.requests >= self.limits.max_requests:
            return False
        self.requests += 1
        return True

    def account(self, size: int) -> bool:
        self.bytes += size
        return self.bytes <= self.limits.max_total_bytes


class BrowserRenderingTransport:
    """Static fetch first; renders only pages that look like JavaScript shells.

    Rendering runs on one dedicated thread that owns the Playwright instance, so the
    transport is safe to share across collector workers. Renders are serialized.
    """

    def __init__(
        self,
        transport: Transport | None = None,
        *,
        min_text_chars: int = 200,
        limits: RenderLimits | None = None,
    ) -> None:
        self.transport = transport if transport is not None else SafeHTTPTransport()
        self.min_text_chars = min_text_chars
        self.limits = limits or RenderLimits()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="collection-browser")
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._closed = False
        self._lock = threading.Lock()

    def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse:
        deadline = time.monotonic() + timeout
        response = self.transport.fetch(url, timeout=timeout, max_bytes=max_bytes)
        if not 200 <= response.status < 300:
            return response
        content_type = response.headers.get("content-type", "")
        if not needs_rendering(response.body, content_type, min_text_chars=self.min_text_chars):
            return response
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise CollectionFailure("timeout", "Retrieval deadline exceeded")
        rendered = self.render(url, response, timeout=remaining, max_bytes=max_bytes)
        headers = dict(response.headers)
        headers["content-type"] = "text/html; charset=utf-8"
        return FetchResponse(response.status, headers, rendered)

    def render(self, url: str, document: FetchResponse, *, timeout: float, max_bytes: int) -> bytes:
        with self._lock:
            if self._closed:
                raise CollectionFailure("render_failed", "Browser rendering is closed")
            future: Future[bytes] = self._executor.submit(
                self._render, url, document, timeout, max_bytes
            )
        try:
            return future.result(timeout=timeout + 5)
        except FutureTimeout as exc:
            raise CollectionFailure("timeout", "Rendering deadline exceeded") from exc

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            self._executor.submit(self._shutdown).result(timeout=15)
            self._executor.shutdown(wait=False)

    # Everything below runs on the dedicated browser thread.

    def _browser_instance(self) -> "Browser":
        if self._browser is not None and self._browser.is_connected():
            return self._browser
        from playwright.sync_api import sync_playwright

        if self._playwright is None:
            self._playwright = sync_playwright().start()
        # Name resolution is disabled and IP literals hit a dead proxy, so the only way
        # any bytes reach the page is through the route handler below.
        self._browser = self._playwright.chromium.launch(
            headless=True,
            args=["--host-resolver-rules=MAP * ~NOTFOUND", "--disable-extensions"],
            proxy={"server": "http://127.0.0.1:9", "bypass": "<-loopback>"},
        )
        return self._browser

    def _shutdown(self) -> None:
        try:
            if self._browser is not None:
                self._browser.close()
            if self._playwright is not None:
                self._playwright.stop()
        finally:
            self._browser = None
            self._playwright = None

    def _render(self, url: str, document: FetchResponse, timeout: float, max_bytes: int) -> bytes:
        try:
            from playwright.sync_api import Error as PlaywrightError
            from playwright.sync_api import TimeoutError as PlaywrightTimeout

            browser = self._browser_instance()
        except Exception as exc:  # Playwright/driver unavailable; keep details out of evidence.
            logger.warning("Browser rendering unavailable: %s", type(exc).__name__)
            raise CollectionFailure("render_failed", "Browser rendering is unavailable") from exc

        deadline = time.monotonic() + timeout
        budget = _RequestBudget(self.limits)
        served_document = False

        def handle(route: "Route", request: "Request") -> None:
            nonlocal served_document
            if request.method != "GET" or request.resource_type not in _ALLOWED_RESOURCES:
                route.abort("blockedbyclient")
                return
            if request.is_navigation_request():
                if served_document or request.url != url:
                    route.abort("blockedbyclient")
                    return
                served_document = True
                route.fulfill(
                    status=document.status,
                    headers={"content-type": document.headers.get("content-type", "text/html")},
                    body=document.body,
                )
                return
            if not budget.admit():
                route.abort("blockedbyclient")
                return
            try:
                response = self._fetch_resource(request.url, deadline, budget)
            except CollectionFailure:
                route.abort("blockedbyclient")
                return
            route.fulfill(
                status=response.status,
                headers={
                    key: value
                    for key, value in response.headers.items()
                    if key in _FORWARDED_HEADERS
                },
                body=response.body,
            )

        context = browser.new_context(
            service_workers="block",
            accept_downloads=False,
            user_agent="PublicSourceResearch/1.0",
        )
        try:
            page = context.new_page()
            page.on("dialog", lambda dialog: dialog.dismiss())
            page.on("popup", lambda popup: popup.close())
            page.route("**/*", handle)
            page.goto(url, wait_until="domcontentloaded", timeout=max(timeout, 0.1) * 1000)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CollectionFailure("timeout", "Rendering deadline exceeded")
            try:
                page.wait_for_load_state(
                    "networkidle",
                    timeout=min(remaining, self.limits.idle_wait_seconds) * 1000,
                )
            except PlaywrightTimeout:
                pass  # Long-polling pages never go idle; the DOM so far is still usable.
            content = page.content().encode()
        except PlaywrightTimeout as exc:
            raise CollectionFailure("timeout", "Rendering deadline exceeded") from exc
        except PlaywrightError as exc:
            raise CollectionFailure("render_failed", "Page could not be rendered") from exc
        finally:
            context.close()
        if len(content) > max_bytes:
            raise CollectionFailure("content_too_large", "Rendered page exceeds byte limit")
        return content

    def _fetch_resource(self, url: str, deadline: float, budget: _RequestBudget) -> FetchResponse:
        current = canonical_url(url)
        for hop in range(self.limits.max_redirects + 1):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CollectionFailure("timeout", "Rendering deadline exceeded")
            response = self.transport.fetch(
                current, timeout=remaining, max_bytes=self.limits.max_resource_bytes
            )
            if response.status not in _REDIRECTS:
                if not budget.account(len(response.body)):
                    raise CollectionFailure("content_too_large", "Render byte budget exceeded")
                return response
            location = response.headers.get("location")
            if not location or hop == self.limits.max_redirects:
                raise CollectionFailure("redirect_limit", "Resource redirect limit exceeded")
            current = canonical_url(urljoin(current, location))
        raise CollectionFailure("redirect_limit", "Resource redirect limit exceeded")

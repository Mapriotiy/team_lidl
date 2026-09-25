import pytest

from app.jobs.imports import canonical_domain


@pytest.mark.parametrize(
    "value,expected",
    [
        (" HTTPS://WWW.Example.COM/path?q=1 ", "example.com"),
        ("example.com.", "example.com"),
        ("bücher.de", "xn--bcher-kva.de"),
        ("news.example.com", "news.example.com"),
    ],
)
def test_canonical_domains(value: str, expected: str) -> None:
    assert canonical_domain(value) == expected


@pytest.mark.parametrize(
    "value",
    [
        "",
        "localhost",
        "127.0.0.1",
        "[::1]",
        "ftp://example.com",
        "https://me@example.com",
        "foo.local",
        "-bad.example.com",
        "foo..com",
        "https://example.com:444",
        "a b.com",
        "https://example.com:bad",
        "https://example.com\\@localhost",
        "123.456",
    ],
)
def test_rejects_invalid_domains(value: str) -> None:
    with pytest.raises(ValueError):
        canonical_domain(value)

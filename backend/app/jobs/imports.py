"""Validate identities without making network requests; collectors enforce DNS safety."""

import ipaddress
import re
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.research import Company


def canonical_domain(value: str) -> str:
    value = value.strip()
    if not value or any(char.isspace() or ord(char) < 32 for char in value) or "\\" in value:
        raise ValueError("Provide a public domain or HTTP(S) URL")
    parsed = urlsplit(value if "://" in value else "https://" + value)
    if (
        parsed.scheme not in {"http", "https"}
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("Only credential-free HTTP(S) identities are supported")
    if not parsed.hostname or parsed.port not in {None, 80, 443}:
        raise ValueError("Provide a public hostname with a standard HTTP(S) port")
    host = parsed.hostname.rstrip(".").encode("idna").decode("ascii").lower()
    if host.startswith("www."):
        host = host[4:]
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError("Use a company domain rather than an IP address")
    labels = host.split(".")
    if (
        len(host) > 253
        or len(labels) < 2
        or labels[-1].isdigit()
        or labels[-1] in {"localhost", "local", "internal", "test", "invalid"}
        or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", x) for x in labels)
    ):
        raise ValueError("Provide a valid public company domain")
    return host


def import_company(session: Session, value: str) -> tuple[Company, bool]:
    domain = canonical_domain(value)
    existing = session.scalar(select(Company).where(Company.canonical_domain == domain))
    if existing is not None:
        return existing, False
    company = Company(canonical_domain=domain, display_name=domain, aliases=[])
    try:
        with session.begin_nested():
            session.add(company)
            session.flush()
    except IntegrityError:
        existing = session.scalar(select(Company).where(Company.canonical_domain == domain))
        if existing is None:
            raise
        return existing, False
    return company, True

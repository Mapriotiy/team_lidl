"""Preloaded company identities used for fast, repeatable discovery."""

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.profile import new_id, utc_now


class CatalogCompany(Base):
    __tablename__ = "company_catalog"
    __table_args__ = (
        UniqueConstraint("entity_id", name="uq_catalog_entity"),
        UniqueConstraint("domain", name="uq_catalog_domain"),
        Index("ix_catalog_country_employees", "country_code", "employee_count"),
        Index("ix_catalog_industry", "industry"),
        Index("ix_catalog_updated", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_id: Mapped[str] = mapped_column(String(32))
    display_name: Mapped[str] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(String(253))
    country_code: Mapped[str] = mapped_column(String(2))
    country_name: Mapped[str] = mapped_column(String(120))
    industry: Mapped[str | None] = mapped_column(String(200))
    employee_count: Mapped[int | None] = mapped_column(Integer)
    website_url: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

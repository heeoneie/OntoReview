"""SQLAlchemy 2.0 models for the persistent ontology graph."""

from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class AuditEventType(str, PyEnum):
    """Allowed event types for the audit trail."""

    SCAN_STARTED = "scan_started"
    REVIEW_CLASSIFIED = "review_classified"
    PRECEDENT_MATCHED = "precedent_matched"
    RISK_FLAGGED = "risk_flagged"
    SCAN_COMPLETED = "scan_completed"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(512), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity_score: Mapped[float] = mapped_column(Float, default=0.0)
    case_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    estimated_loss_usd: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str | None] = mapped_column(String(256), nullable=True)
    owl_class: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reasoning_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow,
    )

    outgoing_edges: Mapped[list["Edge"]] = relationship(
        "Edge", foreign_keys="Edge.source_node_id", back_populates="source_node",
        cascade="all, delete-orphan", passive_deletes=True,
    )
    incoming_edges: Mapped[list["Edge"]] = relationship(
        "Edge", foreign_keys="Edge.target_node_id", back_populates="target_node",
        cascade="all, delete-orphan", passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("normalized_name", "type", name="uq_node_norm_name_type"),
        CheckConstraint("estimated_loss_usd >= 0", name="ck_node_estimated_loss_nonneg"),
    )


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_node_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False,
    )
    target_node_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False,
    )
    relationship_type: Mapped[str] = mapped_column(String(128), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    source: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow,
    )

    source_node: Mapped["Node"] = relationship(
        "Node", foreign_keys=[source_node_id], back_populates="outgoing_edges",
    )
    target_node: Mapped["Node"] = relationship(
        "Node", foreign_keys=[target_node_id], back_populates="incoming_edges",
    )

    __table_args__ = (
        UniqueConstraint(
            "source_node_id", "target_node_id", "relationship_type",
            name="uq_edge_src_tgt_rel",
        ),
    )


class Review(Base):
    """Ingested review from any source (Amazon, Coupang, CSV, etc.)."""

    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_1_5"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    product_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    body: Mapped[str] = mapped_column(String(4096), nullable=False)
    severity: Mapped[float] = mapped_column(Float, default=0.0)
    risk_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow,
    )


class AuditEvent(Base):
    """Append-only audit log for the risk detection pipeline."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True,
    )
    scan_id: Mapped[str] = mapped_column(
        String(36), index=True, nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow,
        nullable=False, index=True,
    )
    event_type: Mapped[str] = mapped_column(
        Enum(AuditEventType), nullable=False,
    )
    review_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True,
    )
    risk_category: Mapped[str | None] = mapped_column(
        String(128), nullable=True,
    )
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(
        String(64), default="system",
    )


class CustomRule(Base):
    """Domain-specific risk rules uploaded via Ontology Studio."""

    __tablename__ = "custom_rules"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True,
    )
    domain_name: Mapped[str] = mapped_column(
        String(128), nullable=False,
    )
    keyword: Mapped[str] = mapped_column(
        String(256), nullable=False,
    )
    owl_class: Mapped[str] = mapped_column(
        String(128), nullable=False,
    )
    severity_override: Mapped[float] = mapped_column(
        Float, default=5.0,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow,
    )

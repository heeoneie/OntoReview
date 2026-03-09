"""Audit event logging service — append-only trail for Duty of Care."""

import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

from backend.database.models import AuditEvent, AuditEventType

logger = logging.getLogger(__name__)


def _safe_json_loads(raw: str | None) -> dict | None:
    """Defensively parse JSON string, returning fallback on failure."""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Malformed JSON in audit details: %.100s", raw)
        return {"_raw": raw}


def log_event(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    db: Session,
    scan_id: str,
    event_type: AuditEventType,
    review_id: Optional[str] = None,
    risk_category: Optional[str] = None,
    details: Optional[dict] = None,
    created_by: str = "system",
) -> AuditEvent:
    """Append a single audit event to the database."""
    event = AuditEvent(
        scan_id=scan_id,
        event_type=event_type,
        review_id=review_id,
        risk_category=risk_category,
        details=json.dumps(details, ensure_ascii=False) if details else None,
        created_by=created_by,
    )
    db.add(event)
    db.flush()
    return event


def get_recent_events(db: Session, limit: int = 50) -> list[dict]:
    """Return the most recent audit events, newest first."""
    rows = (
        db.query(AuditEvent)
        .order_by(AuditEvent.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "scan_id": r.scan_id,
            "timestamp": (
                r.timestamp.isoformat() if r.timestamp else None
            ),
            "event_type": r.event_type,
            "review_id": r.review_id,
            "risk_category": r.risk_category,
            "details": _safe_json_loads(r.details),
            "created_by": r.created_by,
        }
        for r in rows
    ]

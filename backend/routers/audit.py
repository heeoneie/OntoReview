"""Audit log endpoints — read/write pipeline events."""

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.database.models import AuditEventType
from backend.services.audit_service import get_recent_events, log_event

router = APIRouter()


class AuditLogRequest(BaseModel):
    event_type: AuditEventType
    scan_id: str | None = None
    review_id: str | None = None
    risk_category: str | None = None
    details: dict | None = None
    created_by: str = "system"


@router.get("/events")
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return the latest audit events ordered by timestamp DESC."""
    return get_recent_events(db, limit=limit)


@router.post("/log")
def create_audit_event(
    body: AuditLogRequest,
    db: Session = Depends(get_db),
):
    """Manually log an audit event (debugging / external triggers)."""
    scan_id = body.scan_id or str(uuid.uuid4())
    log_event(
        db,
        scan_id=scan_id,
        event_type=body.event_type,
        review_id=body.review_id,
        risk_category=body.risk_category,
        details=body.details,
        created_by=body.created_by,
    )
    db.commit()
    return {"status": "ok", "scan_id": scan_id}

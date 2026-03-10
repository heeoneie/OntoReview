"""Audit log endpoints — read-only access to the append-only audit trail.

Write operations are performed exclusively by internal services (e.g.,
amazon_service) via audit_service.log_event(). No public POST endpoint
is exposed to preserve audit log integrity without an auth layer.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.services.audit_service import get_recent_events

router = APIRouter()


@router.get("/events")
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return the latest audit events ordered by timestamp DESC."""
    return get_recent_events(db, limit=limit)

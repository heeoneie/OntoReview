"""Global Compliance Tracker router — multi-jurisdiction regulation check."""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.compliance_tracker_service import (
    check_compliance,
    get_compliance_summary,
    get_regulations,
    VALID_JURISDICTIONS,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class ComplianceCheckRequest(BaseModel):
    """Request body for compliance check."""

    category: str = Field("Product Liability", description="Risk category")
    description: str = Field("", description="Risk description")
    severity: float = Field(5.0, ge=1.0, le=10.0)
    keywords: str = Field("", description="Comma-separated keywords")
    jurisdictions: Optional[list[str]] = Field(
        None, description="Jurisdictions to check (US, EU, KR)"
    )


@router.get("/regulations")
def list_regulations(jurisdiction: str | None = None):
    """Return regulations for a jurisdiction (or all)."""
    regs = get_regulations(jurisdiction)
    return {
        "regulations": regs,
        "jurisdictions": VALID_JURISDICTIONS,
        "count": len(regs),
    }


@router.post("/check")
def run_compliance_check(body: ComplianceCheckRequest):
    """Check risk data against multi-jurisdiction regulations."""
    violations = check_compliance(
        risk_data=body.model_dump(),
        jurisdictions=body.jurisdictions,
    )
    summary = get_compliance_summary(violations)
    return {
        "violations": violations,
        "summary": summary,
        "jurisdictions_checked": body.jurisdictions or VALID_JURISDICTIONS,
    }


@router.get("/summary")
def compliance_summary():
    """Return overall compliance status (no active check)."""
    summary = get_compliance_summary()
    return summary

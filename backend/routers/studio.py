"""Domain Ontology Studio router — upload domain knowledge & manage rules."""

import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.services.ontology_studio_service import (
    add_custom_rule,
    delete_custom_rule,
    get_custom_rules,
    upload_domain_knowledge,
    VALID_OWL_CLASSES,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class RuleCreateRequest(BaseModel):
    domain_name: str = "custom"
    keyword: str = Field(..., min_length=1, max_length=256)
    owl_class: str = "ProductLiability"
    severity_override: float = Field(default=5.0, ge=1.0, le=10.0)


@router.post("/upload")
async def upload_document(
    file: UploadFile | None = File(None),
    text_content: str = Form(""),
    domain_name: str = Form("custom"),
    db: Session = Depends(get_db),
):
    """Upload a document or paste text to extract domain risk rules."""
    content = text_content
    if file is not None:
        raw = await file.read()
        content = raw.decode("utf-8", errors="replace")

    if not content.strip():
        raise HTTPException(400, "No content provided")

    rules = upload_domain_knowledge(content, domain_name, db)
    return {
        "extracted_rules": rules,
        "count": len(rules),
        "owl_classes": VALID_OWL_CLASSES,
    }


@router.get("/rules")
def list_rules(db: Session = Depends(get_db)):
    """Return all custom rules."""
    return get_custom_rules(db)


@router.post("/rules")
def create_rule(
    body: RuleCreateRequest, db: Session = Depends(get_db),
):
    """Add a custom rule manually."""
    try:
        result = add_custom_rule(body.model_dump(), db)
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to add custom rule")
        raise HTTPException(500, "Failed to add rule") from exc


@router.delete("/rules/{rule_id}")
def remove_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a custom rule by ID."""
    found = delete_custom_rule(rule_id, db)
    if not found:
        raise HTTPException(404, f"Rule {rule_id} not found")
    return {"deleted": True, "id": rule_id}

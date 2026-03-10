"""Agent Communication Setup router — configure AI agent autonomy."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.agent_service import (
    get_agent_configs,
    get_agent_config,
    simulate_agent_response,
    update_agent_config,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class AgentUpdateRequest(BaseModel):
    autonomy_level: int | None = Field(None, ge=1, le=5)
    allowed_actions: list[str] | None = None
    escalation_threshold: float | None = Field(None, ge=1.0, le=10.0)
    auto_response: bool | None = None


class SimulateRequest(BaseModel):
    agent_type: str
    severity: float = Field(default=5.0, ge=1.0, le=10.0)
    risk_category: str = "Product Liability"
    review_text: str = ""
    lang: str = "ko"


@router.get("/configs")
def list_agent_configs():
    """Return all agent configurations."""
    return get_agent_configs()


@router.get("/configs/{agent_type}")
def get_single_agent_config(agent_type: str):
    """Return a single agent's configuration."""
    config = get_agent_config(agent_type)
    if config is None:
        raise HTTPException(404, f"Agent '{agent_type}' not found")
    return config


@router.put("/configs/{agent_type}")
def update_single_agent_config(
    agent_type: str, body: AgentUpdateRequest,
):
    """Update an agent's configuration."""
    try:
        updates = body.model_dump(exclude_none=True)
        result = update_agent_config(agent_type, updates)
        return result
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/simulate")
def simulate(body: SimulateRequest):
    """Simulate agent response to a risk event."""
    try:
        result = simulate_agent_response(
            agent_type=body.agent_type,
            risk_data={
                "severity": body.severity,
                "risk_category": body.risk_category,
                "review_text": body.review_text,
            },
            lang=body.lang,
        )
        return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Agent simulation failed: %s", exc)
        raise HTTPException(
            500, "Agent simulation failed"
        ) from exc

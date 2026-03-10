"""Agent Communication Setup — autonomy & escalation config for AI agents.

Manages Legal, CS, and Operations agents with configurable autonomy levels,
allowed actions, escalation thresholds, and auto-response toggles.
"""

import json
import logging

from core.utils.json_utils import extract_json_from_text
from core.utils.openai_client import call_openai_json, get_client

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────
#  Agent Preset Definitions
# ──────────────────────────────────────────

_DEFAULT_CONFIGS: dict[str, dict] = {
    "legal": {
        "agent_type": "legal",
        "label": "Legal Agent",
        "autonomy_level": 4,
        "allowed_actions": [
            "auto_risk_classification",
            "precedent_matching",
            "settlement_range_proposal",
            "escalation_to_executive",
            "compliance_report_draft",
        ],
        "escalation_threshold": 8.0,
        "auto_response": True,
        "description_ko": (
            "자동 법적 리스크 분류, severity 8 이상 시 "
            "자동 에스컬레이션, 합의안 범위 제안"
        ),
        "description_en": (
            "Auto legal risk classification, auto-escalation "
            "at severity 8+, settlement range proposal"
        ),
    },
    "cs": {
        "agent_type": "cs",
        "label": "CS Agent",
        "autonomy_level": 3,
        "allowed_actions": [
            "auto_reply_draft",
            "sentiment_triage",
            "refund_recommendation",
            "escalation_to_human",
            "customer_followup",
        ],
        "escalation_threshold": 5.0,
        "auto_response": True,
        "description_ko": (
            "자동 고객 응대 초안 작성, severity 5 이하 자율 응대, "
            "5 이상은 사람에게 에스컬레이션"
        ),
        "description_en": (
            "Auto response drafting, autonomous handling "
            "at severity ≤5, human escalation above 5"
        ),
    },
    "operations": {
        "agent_type": "operations",
        "label": "Operations Agent",
        "autonomy_level": 3,
        "allowed_actions": [
            "recall_process_trigger",
            "supply_chain_alert",
            "internal_report_generation",
            "inventory_hold",
            "vendor_notification",
        ],
        "escalation_threshold": 7.0,
        "auto_response": False,
        "description_ko": (
            "리콜 프로세스 자동 트리거, 공급망 알림, "
            "내부 보고서 자동 생성"
        ),
        "description_en": (
            "Auto recall process trigger, supply chain "
            "alerts, internal report generation"
        ),
    },
}

# In-memory store (SQLite 불필요 — 해커톤 데모용)
_agent_configs: dict[str, dict] = {}


def _ensure_defaults():
    """Populate in-memory store with defaults if empty."""
    if not _agent_configs:
        for key, preset in _DEFAULT_CONFIGS.items():
            _agent_configs[key] = {**preset}


def get_agent_configs() -> list[dict]:
    """Return all agent configurations."""
    _ensure_defaults()
    return list(_agent_configs.values())


def get_agent_config(agent_type: str) -> dict | None:
    """Return config for a specific agent type."""
    _ensure_defaults()
    return _agent_configs.get(agent_type)


def update_agent_config(agent_type: str, updates: dict) -> dict:
    """Update an agent's configuration. Returns updated config."""
    _ensure_defaults()
    if agent_type not in _agent_configs:
        raise ValueError(f"Unknown agent_type: {agent_type}")

    config = _agent_configs[agent_type]
    allowed_fields = {
        "autonomy_level",
        "allowed_actions",
        "escalation_threshold",
        "auto_response",
    }
    for field, value in updates.items():
        if field in allowed_fields:
            config[field] = value

    return config


def simulate_agent_response(  # pylint: disable=too-many-locals
    agent_type: str,
    risk_data: dict,
    lang: str = "ko",
) -> dict:
    """Simulate how an agent would respond to given risk data.

    Uses LLM to generate a realistic agent response based on
    the agent's current config and the incoming risk.
    """
    _ensure_defaults()
    config = _agent_configs.get(agent_type)
    if config is None:
        return {"error": f"Unknown agent_type: {agent_type}"}

    severity = risk_data.get("severity", 5.0)
    risk_category = risk_data.get("risk_category", "Unknown")
    review_text = risk_data.get("review_text", "")
    threshold = config["escalation_threshold"]
    autonomy = config["autonomy_level"]
    auto_resp = config["auto_response"]

    # Determine escalation
    will_escalate = severity >= threshold
    can_auto_handle = auto_resp and not will_escalate

    lang_label = "한국어" if lang == "ko" else "English"
    prompt = f"""You are a {config['label']} AI agent in a brand risk \
management system.

Your configuration:
- Autonomy Level: {autonomy}/5
- Escalation Threshold: {threshold}
- Auto-Response: {auto_resp}
- Allowed Actions: {json.dumps(config['allowed_actions'])}

Incoming risk event:
- Severity: {severity}/10
- Category: {risk_category}
- Review: "{review_text[:300]}"

Based on your config, generate a JSON response in {lang_label}:
{{
  "decision": "auto_handle" or "escalate",
  "confidence": 0.0-1.0,
  "actions_taken": ["action1", "action2"],
  "message": "brief explanation of decision",
  "escalation_target": "department or null",
  "estimated_resolution_time": "e.g. 2 hours",
  "risk_assessment": "brief risk assessment"
}}

Rules:
- If severity >= {threshold}, you MUST escalate
- If auto_response is false, always escalate
- Higher autonomy = more detailed autonomous actions
- Keep message concise (1-2 sentences)"""

    try:
        client = get_client()
        raw = call_openai_json(client, prompt)

        # Parse JSON from response
        result = extract_json_from_text(raw)
        if result:
            result["agent_type"] = agent_type
            result["config_snapshot"] = {
                "autonomy_level": autonomy,
                "escalation_threshold": threshold,
                "auto_response": auto_resp,
            }
            return result
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Agent simulation LLM failed: %s", exc)

    # Fallback: deterministic response
    return _fallback_response(
        agent_type, config, severity, risk_category,
        will_escalate, can_auto_handle, lang,
    )


def _fallback_response(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    agent_type, config, severity, risk_category,
    will_escalate, can_auto_handle, lang,
):
    """Deterministic fallback when LLM is unavailable."""
    if lang == "ko":
        if will_escalate:
            msg = (
                f"심각도 {severity}이(가) 임계값 "
                f"{config['escalation_threshold']}을 초과하여 "
                f"에스컬레이션합니다."
            )
        elif can_auto_handle:
            msg = f"자율 처리 가능 범위 내. {risk_category} 자동 대응 실행."
        else:
            msg = "자동 응답 비활성화 — 담당자에게 전달합니다."
    else:
        if will_escalate:
            msg = (
                f"Severity {severity} exceeds threshold "
                f"{config['escalation_threshold']}. Escalating."
            )
        elif can_auto_handle:
            msg = (
                f"Within autonomous range. "
                f"Auto-handling {risk_category}."
            )
        else:
            msg = "Auto-response disabled — forwarding to human."

    escalation_targets = {
        "legal": "Executive / CLO",
        "cs": "CS Team Lead",
        "operations": "Operations Director",
    }

    return {
        "agent_type": agent_type,
        "decision": "escalate" if will_escalate else "auto_handle",
        "confidence": 0.85 if not will_escalate else 0.95,
        "actions_taken": config["allowed_actions"][:2],
        "message": msg,
        "escalation_target": (
            escalation_targets.get(agent_type) if will_escalate
            else None
        ),
        "estimated_resolution_time": (
            "4 hours" if will_escalate else "30 minutes"
        ),
        "risk_assessment": (
            f"{risk_category} — severity {severity}/10"
        ),
        "config_snapshot": {
            "autonomy_level": config["autonomy_level"],
            "escalation_threshold": config["escalation_threshold"],
            "auto_response": config["auto_response"],
        },
    }

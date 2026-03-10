"""Domain Ontology Studio — upload domain knowledge to customize risk rules.

Allows enterprises to upload internal regulations/manuals and extract
domain-specific risk keywords, mapping them to OWL ontology classes.
"""

import json
import logging

from sqlalchemy.orm import Session

from backend.database.models import CustomRule
from backend.services.ontology_engine import (
    _get_onto,
    _KEYWORD_TO_OWL_CLASS,
)
from core.utils.openai_client import call_openai_json, get_client

logger = logging.getLogger(__name__)

# Valid OWL classes that custom rules can map to
VALID_OWL_CLASSES = [
    "ProductLiability", "SkinReaction", "ChemicalBurn",
    "Ingestion", "Choking", "RegulatoryRisk", "FDAViolation",
    "RecallEvent", "ClassAction", "ConsumerFraud", "Counterfeit",
    "MisleadingLabel", "FoodSafety", "Contamination",
    "Expiration", "Allergen",
]


def upload_domain_knowledge(
    file_content: str, domain_name: str, db: Session,  # pylint: disable=unused-argument
) -> list[dict]:
    """Extract domain-specific risk keywords from text via LLM.

    Returns list of extracted rules (not yet persisted — caller
    can review before saving).
    """
    prompt = f"""Analyze the following company internal document and \
extract risk-related keywords and rules.

## Document (domain: {domain_name})
{file_content[:3000]}

## Available OWL Risk Classes
{json.dumps(VALID_OWL_CLASSES)}

## Task
Extract risk keywords specific to this company/domain.
For each keyword, determine:
1. The keyword or phrase (lowercase)
2. Which OWL risk class it maps to
3. A severity score (1-10)

Return JSON:
{{
  "rules": [
    {{
      "keyword": "peeling",
      "owl_class": "SkinReaction",
      "severity_override": 8,
      "rationale": "Company product known for skin issues"
    }}
  ],
  "domain_summary": "Brief summary of domain risks found"
}}

Rules:
- Extract 3-10 keywords maximum
- Only use OWL classes from the provided list
- Severity: 1-3 low, 4-6 medium, 7-8 high, 9-10 critical
- Focus on company-specific terms, not generic ones"""

    try:
        client = get_client()
        raw = call_openai_json(client, prompt)
        result = _parse_json(raw)
        if result and "rules" in result:
            return result["rules"]
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Domain knowledge LLM extraction failed: %s", exc)

    return []


def get_custom_rules(db: Session) -> list[dict]:
    """Return all custom rules from the database."""
    rules = db.query(CustomRule).order_by(
        CustomRule.created_at.desc()
    ).all()
    return [
        {
            "id": r.id,
            "domain_name": r.domain_name,
            "keyword": r.keyword,
            "owl_class": r.owl_class,
            "severity_override": r.severity_override,
            "created_at": r.created_at.isoformat()
            if r.created_at else None,
        }
        for r in rules
    ]


def add_custom_rule(rule: dict, db: Session) -> dict:
    """Add a custom rule to the database and register it in OWL.

    Returns the persisted rule dict.
    """
    owl_class = rule.get("owl_class", "ProductLiability")
    if owl_class not in VALID_OWL_CLASSES:
        owl_class = "ProductLiability"

    keyword = rule["keyword"].lower().strip()
    severity = min(10.0, max(1.0, float(rule.get(
        "severity_override", 5.0
    ))))
    domain = rule.get("domain_name", "custom")

    db_rule = CustomRule(
        domain_name=domain,
        keyword=keyword,
        owl_class=owl_class,
        severity_override=severity,
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)

    # Register in runtime OWL keyword map
    _register_keyword(keyword, owl_class)

    return {
        "id": db_rule.id,
        "domain_name": db_rule.domain_name,
        "keyword": db_rule.keyword,
        "owl_class": db_rule.owl_class,
        "severity_override": db_rule.severity_override,
        "created_at": db_rule.created_at.isoformat()
        if db_rule.created_at else None,
    }


def delete_custom_rule(rule_id: int, db: Session) -> bool:
    """Delete a custom rule by ID. Returns True if found."""
    rule = db.query(CustomRule).filter(
        CustomRule.id == rule_id
    ).first()
    if rule is None:
        return False

    # Remove from runtime keyword map
    keyword = rule.keyword.lower().strip()
    _KEYWORD_TO_OWL_CLASS.pop(keyword, None)

    db.delete(rule)
    db.commit()
    return True


def load_custom_rules_into_ontology(db: Session) -> int:
    """Load all persisted custom rules into the runtime OWL map.

    Called at startup to restore custom keywords.
    Returns count of rules loaded.
    """
    rules = db.query(CustomRule).all()
    count = 0
    for rule in rules:
        _register_keyword(rule.keyword.lower().strip(), rule.owl_class)
        count += 1
    if count:
        logger.info("Loaded %d custom rules into OWL keyword map", count)
    return count


def _register_keyword(keyword: str, owl_class: str):
    """Register a keyword in the runtime OWL keyword map."""
    _KEYWORD_TO_OWL_CLASS[keyword] = owl_class

    # Ensure OWL class exists in ontology
    onto = _get_onto()
    if onto[owl_class] is None:
        logger.warning(
            "OWL class '%s' not found — keyword '%s' mapped but "
            "class may not exist in ontology",
            owl_class, keyword,
        )


def _parse_json(text: str) -> dict | None:
    """Extract JSON object from LLM response."""
    import re  # pylint: disable=import-outside-toplevel
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            return None
    return None

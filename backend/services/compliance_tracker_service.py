"""Global Compliance Tracker — multi-jurisdiction regulation matching.

Checks detected risks against US / EU / KR consumer protection regulations
and estimates violation likelihood via LLM analysis.
"""

import logging

from core.utils.json_utils import extract_json_from_text
from core.utils.openai_client import call_openai_json, get_client

logger = logging.getLogger(__name__)

# ── Hard-coded regulation database (3 jurisdictions) ──

REGULATIONS: dict[str, list[dict]] = {
    "US": [
        {
            "id": "US-FDA-21CFR",
            "name": "FDA 21 CFR (Cosmetics & Food)",
            "jurisdiction": "US",
            "category": "cosmetics/food",
            "severity_weight": 9,
            "description": (
                "Federal regulations governing safety, labeling, "
                "and manufacturing of cosmetics and food products."
            ),
            "url": "https://www.ecfr.gov/current/title-21",
        },
        {
            "id": "US-CPSC",
            "name": "Consumer Product Safety Commission (CPSC)",
            "jurisdiction": "US",
            "category": "general",
            "severity_weight": 9,
            "description": (
                "Federal agency enforcing product safety standards. "
                "Mandatory recall authority for hazardous products."
            ),
            "url": "https://www.cpsc.gov",
        },
        {
            "id": "US-FTC-S5",
            "name": "FTC Act Section 5 — Unfair/Deceptive Practices",
            "jurisdiction": "US",
            "category": "general",
            "severity_weight": 8,
            "description": (
                "Prohibits unfair or deceptive acts in commerce. "
                "Covers false advertising, misleading claims, and "
                "consumer fraud."
            ),
            "url": "https://www.ftc.gov/legal-library/browse/statutes",
        },
        {
            "id": "US-STATE-CP",
            "name": "State Consumer Protection Laws",
            "jurisdiction": "US",
            "category": "general",
            "severity_weight": 7,
            "description": (
                "State-level consumer protection statutes (e.g., "
                "California Prop 65, NY GBL 349). Enable private "
                "right of action and class action lawsuits."
            ),
            "url": "https://consumer.ftc.gov/features/state-consumer-protection",
        },
    ],
    "EU": [
        {
            "id": "EU-GPSD",
            "name": "EU General Product Safety Directive (2001/95/EC)",
            "jurisdiction": "EU",
            "category": "general",
            "severity_weight": 9,
            "description": (
                "Requires all consumer products placed on the EU "
                "market to be safe. Enables RAPEX rapid alert system "
                "for dangerous products."
            ),
            "url": "https://eur-lex.europa.eu/eli/dir/2001/95",
        },
        {
            "id": "EU-REACH",
            "name": "REACH Regulation (EC 1907/2006)",
            "jurisdiction": "EU",
            "category": "cosmetics",
            "severity_weight": 9,
            "description": (
                "Registration, Evaluation, Authorization and "
                "Restriction of Chemicals. Bans or restricts "
                "hazardous substances in consumer products."
            ),
            "url": "https://echa.europa.eu/regulations/reach",
        },
        {
            "id": "EU-CRD",
            "name": "EU Consumer Rights Directive (2011/83/EU)",
            "jurisdiction": "EU",
            "category": "general",
            "severity_weight": 7,
            "description": (
                "Harmonized consumer rights across EU member states. "
                "Covers information requirements, right of withdrawal, "
                "and delivery obligations."
            ),
            "url": "https://eur-lex.europa.eu/eli/dir/2011/83",
        },
    ],
    "KR": [
        {
            "id": "KR-CBA",
            "name": "소비자기본법 (Consumer Basic Act)",
            "jurisdiction": "KR",
            "category": "general",
            "severity_weight": 8,
            "description": (
                "소비자의 기본적 권리 보장 및 소비자 보호 정책의 "
                "기본 사항을 규정하는 법률."
            ),
            "url": "https://law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=소비자기본법",
        },
        {
            "id": "KR-PSA",
            "name": "제품안전기본법 (Product Safety Basic Act)",
            "jurisdiction": "KR",
            "category": "general",
            "severity_weight": 9,
            "description": (
                "제품의 안전성 확보를 위한 기본적 사항을 규정. "
                "위해 제품에 대한 리콜 명령 근거."
            ),
            "url": "https://law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=제품안전기본법",
        },
        {
            "id": "KR-FSA",
            "name": "식품위생법 (Food Sanitation Act)",
            "jurisdiction": "KR",
            "category": "food",
            "severity_weight": 9,
            "description": (
                "식품의 안전성 확보 및 위생 관리에 관한 법률. "
                "식품 제조·가공·유통의 전 과정을 규율."
            ),
            "url": "https://law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=식품위생법",
        },
        {
            "id": "KR-ECA",
            "name": "전자상거래법 (E-Commerce Act)",
            "jurisdiction": "KR",
            "category": "general",
            "severity_weight": 7,
            "description": (
                "전자상거래 및 통신판매에 관한 소비자 보호 법률. "
                "허위·과장 광고 금지, 청약 철회권 보장."
            ),
            "url": "https://law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=전자상거래법",
        },
    ],
}

VALID_JURISDICTIONS = list(REGULATIONS.keys())


def get_regulations(jurisdiction: str | None = None) -> list[dict]:
    """Return regulations for a jurisdiction, or all if None."""
    if jurisdiction and jurisdiction.upper() in REGULATIONS:
        return REGULATIONS[jurisdiction.upper()]
    result = []
    for regs in REGULATIONS.values():
        result.extend(regs)
    return result


def get_compliance_summary(check_results: list[dict] | None = None) -> dict:
    """Compute per-jurisdiction compliance scores from check results."""
    summary: dict[str, dict] = {}
    for jur in VALID_JURISDICTIONS:
        regs = REGULATIONS[jur]
        summary[jur] = {
            "jurisdiction": jur,
            "total_regulations": len(regs),
            "violations_high": 0,
            "violations_medium": 0,
            "violations_low": 0,
            "compliance_pct": 100,
        }

    if not check_results:
        return {"jurisdictions": summary, "overall_score": 100}

    for result in check_results:
        jur = result.get("jurisdiction", "US")
        level = result.get("violation_level", "low").lower()
        if jur in summary:
            if level == "high":
                summary[jur]["violations_high"] += 1
            elif level == "medium":
                summary[jur]["violations_medium"] += 1
            else:
                summary[jur]["violations_low"] += 1

    for jur, data in summary.items():
        total = data["total_regulations"]
        if total == 0:
            continue
        penalty = (
            data["violations_high"] * 30
            + data["violations_medium"] * 15
            + data["violations_low"] * 5
        )
        data["compliance_pct"] = max(0, 100 - penalty)

    scores = [d["compliance_pct"] for d in summary.values()]
    overall = round(sum(scores) / len(scores)) if scores else 100

    return {"jurisdictions": summary, "overall_score": overall}


def check_compliance(
    risk_data: dict, jurisdictions: list[str] | None = None,
) -> list[dict]:
    """Check risks against regulations via LLM analysis.

    Args:
        risk_data: Dict with risk info (category, description, severity, etc.)
        jurisdictions: List of jurisdiction codes to check. Defaults to all.

    Returns:
        List of violation result dicts.
    """
    target_jurs = jurisdictions or VALID_JURISDICTIONS
    target_jurs = [j.upper() for j in target_jurs if j.upper() in REGULATIONS]
    if not target_jurs:
        target_jurs = VALID_JURISDICTIONS

    all_regs = []
    for jur in target_jurs:
        all_regs.extend(REGULATIONS[jur])

    regs_text = "\n".join(
        f"- [{r['id']}] {r['name']} ({r['jurisdiction']}, "
        f"category: {r['category']}): {r['description']}"
        for r in all_regs
    )

    risk_desc = (
        f"Risk Category: {risk_data.get('category', 'Unknown')}\n"
        f"Description: {risk_data.get('description', 'N/A')}\n"
        f"Severity: {risk_data.get('severity', 5)}/10\n"
        f"Keywords: {risk_data.get('keywords', 'N/A')}"
    )

    prompt = f"""Analyze the following detected risk against international \
regulations and determine potential violations.

## Detected Risk
{risk_desc}

## Applicable Regulations
{regs_text}

## Task
For each regulation that this risk may violate, provide:
1. regulation_id — the [ID] from the list
2. jurisdiction — US, EU, or KR
3. violation_level — "high", "medium", or "low"
4. explanation — brief explanation of why this regulation may be violated
5. recommended_action — what the company should do

Only include regulations that are actually relevant to this risk.
If no violations found, return empty array.

Return JSON:
{{
  "violations": [
    {{
      "regulation_id": "US-FDA-21CFR",
      "regulation_name": "FDA 21 CFR",
      "jurisdiction": "US",
      "violation_level": "high",
      "explanation": "...",
      "recommended_action": "..."
    }}
  ],
  "risk_summary": "One-sentence summary of overall compliance risk"
}}"""

    try:
        client = get_client()
        raw = call_openai_json(client, prompt)
        result = extract_json_from_text(raw)
        if result and "violations" in result:
            return result["violations"]
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Compliance check LLM failed: %s", exc)

    return _fallback_check(risk_data, target_jurs)


def _fallback_check(
    risk_data: dict, jurisdictions: list[str],
) -> list[dict]:
    """Deterministic fallback when LLM is unavailable."""
    results = []
    category = (risk_data.get("category") or "").lower()
    severity = float(risk_data.get("severity", 5))

    keyword_map = {
        "product liability": ["US-FDA-21CFR", "US-CPSC", "EU-GPSD", "KR-PSA"],
        "regulatory risk": ["US-FDA-21CFR", "EU-REACH", "KR-FSA"],
        "false advertising": ["US-FTC-S5", "EU-CRD", "KR-ECA"],
        "consumer safety": ["US-CPSC", "EU-GPSD", "KR-PSA"],
        "class action risk": ["US-STATE-CP", "US-FTC-S5", "EU-CRD", "KR-CBA"],
    }

    matched_ids = set()
    for key, reg_ids in keyword_map.items():
        if key in category:
            matched_ids.update(reg_ids)

    if not matched_ids:
        matched_ids = {"US-CPSC", "EU-GPSD", "KR-PSA"}

    all_regs = {r["id"]: r for regs in REGULATIONS.values() for r in regs}

    for reg_id in matched_ids:
        reg = all_regs.get(reg_id)
        if not reg or reg["jurisdiction"] not in jurisdictions:
            continue
        level = "high" if severity >= 8 else "medium" if severity >= 5 else "low"
        results.append({
            "regulation_id": reg_id,
            "regulation_name": reg["name"],
            "jurisdiction": reg["jurisdiction"],
            "violation_level": level,
            "explanation": (
                f"Risk severity {severity:.0f}/10 may trigger "
                f"{reg['name']} enforcement."
            ),
            "recommended_action": "Review product compliance and consult legal.",
        })

    return results

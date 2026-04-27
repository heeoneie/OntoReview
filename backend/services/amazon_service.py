"""Amazon mock ingestion — K-Beauty/K-Food reviews with risk tagging.

Saves reviews to the Review table AND creates high-severity Node entries
so the KPI dashboard and risk timeline immediately update.

Pipeline: Review → detect_risk_candidate() → classify_with_llm() → match_precedent()
"""

import json
import logging
from pathlib import Path
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from backend.database.models import AuditEventType, Node, Review
from backend.services.audit_service import log_event
from backend.services.legal_rag_service import match_precedent
from backend.services.ontology_engine import classify_with_ontology, add_risk_instance
from core.analyzer import classify_with_llm

logger = logging.getLogger(__name__)

# Fast keyword filter for risk candidate detection (lightweight pre-filter)
_RISK_CANDIDATE_KEYWORDS = frozenset([
    "rash", "burn", "allergy", "allergic", "lawsuit", "recall",
    "fda", "injury", "hospital", "scar", "toxic", "sue", "choking",
    "fake", "scam", "lie", "melt", "reaction",
    "contaminated", "expired", "mold", "spoiled", "counterfeit",
    "bacteria", "swollen", "blister", "hives", "vomit",
    "diarrhea", "misleading", "deceptive", "banned", "prohibited",
    "parasite", "stomach",
])

# Keyword → canonical risk_category mapping (must match legal_cases.json)
_HIGH_RISK_KEYWORDS = {
    "rash": "Product Liability",
    "burn": "Product Liability",
    "allergy": "Product Liability",
    "allergic": "Product Liability",
    "injury": "Product Liability",
    "hospital": "Product Liability",
    "scar": "Product Liability",
    "toxic": "Product Liability",
    "lawsuit": "Class Action Risk",
    "fda": "Regulatory Risk",
    "recall": "Regulatory Risk",
    "sue": "Class Action Risk",
    "choking": "Consumer Safety",
    "reaction": "Product Liability",
    "fake": "False Advertising",
    "scam": "False Advertising",
    "lie": "False Advertising",
    "melt": "Product Liability",
    "contaminated": "Consumer Safety",
    "expired": "Consumer Safety",
    "mold": "Consumer Safety",
    "spoiled": "Consumer Safety",
    "bacteria": "Consumer Safety",
    "stomach": "Consumer Safety",
    "vomit": "Consumer Safety",
    "diarrhea": "Consumer Safety",
    "parasite": "Consumer Safety",
    "counterfeit": "False Advertising",
    "misleading": "False Advertising",
    "deceptive": "False Advertising",
    "swollen": "Product Liability",
    "blister": "Product Liability",
    "hives": "Product Liability",
    "banned": "Class Action Risk",
    "prohibited": "Class Action Risk",
}


def detect_risk_candidate(text: Optional[str]) -> bool:
    """Fast keyword filter to identify potential risk reviews.

    Only candidate reviews are sent to the LLM for classification,
    saving API costs and reducing latency for safe reviews.

    Returns:
        True if the review contains any risk-related keywords.
    """
    if not text:
        return False
    lower = text.lower()
    return any(re.search(rf"\b{kw}\b", lower) for kw in _RISK_CANDIDATE_KEYWORDS)

MOCK_REVIEWS = [
    # ── Food/CPG Reviews (50 total) ──────────────────────────────────────
    {
        "rating": 1,
        "title": "Protein content 30% less than labeled — misleading",
        "body": (
            "I had this plant-based burger patty tested by my dietitian and the protein content "
            "is only 14g, not the 20g claimed on the package. This is false advertising. "
            "I rely on accurate nutrition info for a medical condition. Filing an FTC complaint."
        ),
    },
    {
        "rating": 1,
        "title": "Undeclared soy allergen caused my daughter's anaphylaxis",
        "body": (
            "My daughter is severely allergic to soy. Nothing on the label mentions soy, but she "
            "had an anaphylactic reaction within minutes of eating this patty. We had to use an EpiPen "
            "and rush to the ER. Filing an FDA complaint and contacting a lawyer."
        ),
    },
    {
        "rating": 1,
        "title": "Patties had grey discoloration inside the package",
        "body": (
            "Opened the package and the patties were grey and green in the center. Clearly "
            "spoiled or improperly stored. My kid took a bite before I noticed and got sick "
            "within hours. This is a food safety hazard."
        ),
    },
    {
        "rating": 1,
        "title": "Food poisoning symptoms 6 hours after eating this",
        "body": (
            "Severe stomach cramps, vomiting, and diarrhea starting 6 hours after eating these "
            "plant-based patties. My wife had the same symptoms. Possible E. coli contamination. "
            "Reporting to FDA MedWatch."
        ),
    },
    {
        "rating": 1,
        "title": "Sodium content is triple what the label claims",
        "body": (
            "I'm on a sodium-restricted diet for heart disease. Had this tested by my nutritionist "
            "and the sodium is 890mg per serving, not the 300mg on the label. This could literally "
            "kill someone. Filing an FTC complaint for false labeling."
        ),
    },
    {
        "rating": 1,
        "title": "Found plastic fragment in the patty",
        "body": (
            "Bit into this burger patty and felt something hard. Pulled out a clear plastic shard "
            "about 1cm long. This is a choking hazard and a manufacturing defect. Saved the fragment "
            "and contacted the company. No response after 2 weeks."
        ),
    },
    {
        "rating": 1,
        "title": "Expired product sold at full price",
        "body": (
            "These plant-based patties arrived already 3 weeks past expiration. The color was off "
            "and they smelled sour. Amazon is selling expired food and this needs to stop. "
            "Demanded a refund and reported to FDA."
        ),
    },
    {
        "rating": 1,
        "title": "Mold on the surface before opening",
        "body": (
            "Visible white and green mold on two of the four patties inside a sealed, non-expired "
            "package. The vacuum seal was intact. This is a cold chain or manufacturing contamination "
            "issue. Reported to FDA and kept evidence."
        ),
    },
    {
        "rating": 1,
        "title": "Nutrition facts don't match independent lab results",
        "body": (
            "I sent this product to an independent lab. The protein is 30% lower than claimed, "
            "fat is 25% higher, and they found undisclosed soy lecithin. Every number on the "
            "nutrition label is wrong. This is systematic fraud."
        ),
    },
    {
        "rating": 1,
        "title": "Labeled 'organic' but contains GMO ingredients",
        "body": (
            "Third-party testing confirmed GMO soy in this 'USDA Organic' labeled product. "
            "This is a federal labeling violation. I've reported this to the USDA organic integrity "
            "database and am considering joining a class action."
        ),
    },
    {
        "rating": 1,
        "title": "E. coli symptoms after consumption — hospitalized",
        "body": (
            "Three days after eating these patties I was hospitalized with confirmed E. coli "
            "infection. Blood in stool, severe dehydration, 5 days in the hospital. CDC has been "
            "notified. If anyone else is sick, please report it."
        ),
    },
    {
        "rating": 1,
        "title": "Claims '100% plant-based' but contains dairy traces",
        "body": (
            "I'm vegan and lactose intolerant. After eating this '100% plant-based' patty I had "
            "a severe lactose reaction. Had it tested — contains casein (dairy protein). "
            "This is a lie on the label and dangerous for people with dairy allergies."
        ),
    },
    {
        "rating": 1,
        "title": "Misleading health claims about heart disease",
        "body": (
            "The marketing says 'heart-healthy alternative' but the saturated fat per serving "
            "is higher than a regular beef patty. My cardiologist was shocked when I showed him "
            "the test results. FTC needs to investigate these health claims."
        ),
    },
    {
        "rating": 2,
        "title": "Package weight 15% less than stated",
        "body": (
            "Weighed these on my kitchen scale — consistently 15% less than the stated package "
            "weight. Across 6 boxes, every single one was short. This is systematic and it's "
            "consumer fraud, plain and simple."
        ),
    },
    {
        "rating": 1,
        "title": "Listeria risk — FDA recall issued but not notified",
        "body": (
            "Found out through a news article that this batch was part of a voluntary recall "
            "for listeria risk. Amazon never notified me. I had already eaten two patties. "
            "The recall system is broken and consumers are at risk."
        ),
    },
    {
        "rating": 2,
        "title": "Ingredients list hides artificial preservatives",
        "body": (
            "The front label says 'no artificial preservatives' but the ingredient list includes "
            "potassium sorbate and sodium benzoate. These are literally artificial preservatives. "
            "Deceptive labeling that violates FDA guidelines."
        ),
    },
    {
        "rating": 1,
        "title": "Cross-contamination with gluten despite 'gluten-free' label",
        "body": (
            "I have celiac disease and trusted the 'gluten-free' label. Had a severe reaction "
            "after eating this. Independent testing confirmed gluten above 20ppm — the FDA threshold. "
            "This is dangerous mislabeling."
        ),
    },
    {
        "rating": 2,
        "title": "Saturated fat content understated by 40%",
        "body": (
            "Had this product tested at a university food science lab. Saturated fat is 8g per "
            "serving, not the 5g on the label. For people managing cholesterol, this understatement "
            "could cause real health harm."
        ),
    },
    {
        "rating": 1,
        "title": "Caused severe allergic reaction — missing allergen warning",
        "body": (
            "Had a full-body allergic reaction after eating this patty. Turns out it contains "
            "methylcellulose derived from tree pulp, which I'm allergic to. No allergen warning "
            "anywhere on the package. This needs to be recalled."
        ),
    },
    {
        "rating": 2,
        "title": "Iron content claim unverified by third-party testing",
        "body": (
            "The label claims 25% daily iron value. I had this tested — it's closer to 8%. "
            "For people relying on this as an iron source, the discrepancy is medically relevant. "
            "The brand should be required to verify these claims."
        ),
    },
    # Rating 3 — moderate concerns
    {
        "rating": 3,
        "title": "Texture was weird but tasted okay",
        "body": (
            "The center of the patty had a mushy, almost raw texture even after cooking to "
            "the recommended temperature. Tasted fine but the texture was off-putting. "
            "Not sure if this is normal for plant-based or a quality issue."
        ),
    },
    {
        "rating": 3,
        "title": "Tastes nothing like the description",
        "body": (
            "The marketing says 'indistinguishable from beef' but this tastes like seasoned "
            "bean paste. Not bad, just misleading. Lower your expectations and it's a decent "
            "product. But the advertising is definitely exaggerated."
        ),
    },
    {
        "rating": 3,
        "title": "Concerned about processing chemicals",
        "body": (
            "Looked into the manufacturing process and this uses hexane extraction for the "
            "protein isolate. There's debate about residual hexane in the final product. "
            "Would prefer a brand that's transparent about processing methods."
        ),
    },
    {
        "rating": 3,
        "title": "Packaging not recyclable despite claims",
        "body": (
            "The package says 'recyclable packaging' but my local recycling center says the "
            "multi-layer film isn't accepted. This is greenwashing. Minor issue compared to "
            "food safety, but still dishonest."
        ),
    },
    # Rating 4 — minor issues
    {
        "rating": 4,
        "title": "Good product but serving size is misleading",
        "body": (
            "The patty is good but the nutrition label serving size is for a 71g patty while "
            "the actual patty weighs 113g. This makes the calories and fat look lower than "
            "they really are. Common industry trick but still annoying."
        ),
    },
    {
        "rating": 4,
        "title": "Solid plant-based option, wish it had less sodium",
        "body": (
            "Flavor is great and it grills nicely. My only concern is the sodium — 390mg per "
            "patty adds up fast if you eat these regularly. Would be 5 stars if they could "
            "reduce the salt without losing flavor."
        ),
    },
    {
        "rating": 4,
        "title": "Good alternative but pricey",
        "body": (
            "These plant-based patties are tasty and cook well on the grill. Price is almost "
            "double regular beef though. Worth it for the environmental angle but the value "
            "proposition needs work."
        ),
    },
    {
        "rating": 4,
        "title": "Kids liked it — good sign",
        "body": (
            "Made these for a family BBQ and even the kids ate them without complaining. "
            "Texture is convincing and the char marks looked great. Would have given 5 stars "
            "but the patties shrank more than expected."
        ),
    },
    # Rating 5 — positive
    {
        "rating": 5,
        "title": "Best plant-based burger I've ever had",
        "body": (
            "Grilled these for a summer cookout and even the beef-lovers were impressed. "
            "Juicy, great char, holds together well. This is the future of protein. "
            "Ordering the bulk pack for the season."
        ),
    },
    {
        "rating": 5,
        "title": "Finally a plant burger that satisfies",
        "body": (
            "After trying every brand on the market, this is the one. The umami flavor is "
            "spot-on and the texture is miles ahead of the competition. My whole family "
            "has switched from beef. No regrets."
        ),
    },
    {
        "rating": 5,
        "title": "Great for meal prep",
        "body": (
            "I meal prep these every Sunday — they reheat perfectly and the macros are solid. "
            "20g protein per patty, low saturated fat. Exactly what I need for my fitness goals. "
            "Subscribe & Save for the win."
        ),
    },
    {
        "rating": 5,
        "title": "Environmentally conscious and delicious",
        "body": (
            "Switched to plant-based for environmental reasons and this product made the "
            "transition painless. Tastes great, cooks great, and I feel good about the "
            "lower carbon footprint. Highly recommend."
        ),
    },
    {
        "rating": 5,
        "title": "Restaurant quality at home",
        "body": (
            "These plant-based patties are as good as what I've had at trendy burger joints. "
            "Added some avocado and special sauce — perfection. My friends couldn't believe "
            "it wasn't real meat. Game changer."
        ),
    },
    {
        "rating": 5,
        "title": "Perfect for plant-based beginners",
        "body": (
            "If you're curious about plant-based meat, start here. The taste is approachable, "
            "it cooks like regular ground beef, and the price has come down a lot. "
            "Even my skeptical husband asked for seconds."
        ),
    },
]


def _classify_severity(text: str) -> tuple[float, str | None, dict | None]:
    """Return (severity_score, risk_label, ontology_result) using LLM + OWL.

    Pipeline:
    1. detect_risk_candidate() → Fast keyword filter
    2. classify_with_llm() → LLM-based classification (only for candidates)
    3. classify_with_ontology() → OWL class mapping + inference rules
    4. add_risk_instance() → Accumulate knowledge in ontology
    5. Return severity (OWL-adjusted) and risk category

    Stability: Always returns safe fallback on any failure.
    """
    # Fast path: skip LLM for non-candidate reviews
    if not detect_risk_candidate(text):
        return 2.0, None, None

    # LLM classification for risk candidates
    try:
        classification = classify_with_llm(text)
        severity = classification["severity"]
        risk_category = classification["risk_category"]

        # Map risk_category to display label
        if risk_category == "Safe":
            return severity, None, None

        # OWL ontology classification + inference
        ontology_result = classify_with_ontology(text, {
            "severity": severity,
            "risk_category": risk_category,
            "channel": "amazon",
        })

        # Use OWL-adjusted severity (may be boosted by occurrence rules)
        adjusted_severity = ontology_result["severity"]

        # Accumulate instance in ontology for future inference
        add_risk_instance({
            **ontology_result,
            "channel": "amazon",
        })

        return adjusted_severity, risk_category, ontology_result

    except Exception as e:  # pylint: disable=broad-except
        # Fallback to simple keyword matching if LLM fails
        logger.warning("LLM classification failed, using keyword fallback: %s", e)
        lower = text.lower()
        for keyword, label in _HIGH_RISK_KEYWORDS.items():
            if re.search(rf"\b{keyword}\b", lower):
                return 9.0, label, None
        return 2.0, None, None


def _match_precedent_for_review(
    full_text: str, risk_label: str, title: str, scan_id: str, db: Session,
):
    """Match legal precedent and log audit events. Returns (precedent_result, case_id, exposure)."""
    try:
        precedent_result = match_precedent(full_text, risk_category=risk_label)
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Precedent matching failed for '%s': %s", title, exc)
        precedent_result = None

    if precedent_result:
        log_event(
            db, scan_id, AuditEventType.PRECEDENT_MATCHED,
            details={
                "title": title,
                "risk_category": risk_label,
                "case_title": precedent_result["primary_match"].get("case_title"),
                "expected_exposure_usd": precedent_result["expected_exposure_usd"],
            },
        )

    return precedent_result


def _upsert_event_node(  # pylint: disable=too-many-arguments,too-many-positional-arguments,too-many-locals
    item: dict, severity: float, risk_label: str, precedent_result,
    ontology_result: dict | None,
    seen_nodes: dict, now: datetime, db: Session,
) -> None:
    """Create or update a risk Node for a review."""
    if precedent_result:
        primary = precedent_result["primary_match"]
        expected_exposure = precedent_result["expected_exposure_usd"]
        dynamic_exposure = int(expected_exposure * (severity / 10.0))
        case_id = primary["case_id"]
    else:
        dynamic_exposure = 0
        case_id = None

    # OWL ontology metadata
    owl_class = ontology_result["risk_class"] if ontology_result else None
    reasoning_json = (
        json.dumps(ontology_result["reasoning_path"], ensure_ascii=False)
        if ontology_result and ontology_result.get("reasoning_path")
        else None
    )

    node_title = item["title"].strip().lower()
    normalized = (risk_label or "unknown risk").strip().lower()
    node_key = f"{node_title}::{normalized}::event"

    if node_key in seen_nodes:
        existing_node = seen_nodes[node_key]
        existing_node.severity_score = max(existing_node.severity_score or 0, severity)
        existing_node.last_seen_at = now
        if owl_class:
            existing_node.owl_class = owl_class
        if reasoning_json:
            existing_node.reasoning_path = reasoning_json
        if precedent_result:
            existing_node.case_id = case_id
            existing_node.estimated_loss_usd = max(
                existing_node.estimated_loss_usd or 0, dynamic_exposure
            )
    else:
        existing_node = (
            db.query(Node)
            .filter(Node.normalized_name == node_key, Node.type == "event")
            .first()
        )
        if existing_node:
            existing_node.severity_score = max(existing_node.severity_score or 0, severity)
            existing_node.last_seen_at = now
            if owl_class:
                existing_node.owl_class = owl_class
            if reasoning_json:
                existing_node.reasoning_path = reasoning_json
            if precedent_result:
                existing_node.case_id = case_id
                existing_node.estimated_loss_usd = max(
                    existing_node.estimated_loss_usd or 0, dynamic_exposure
                )
            seen_nodes[node_key] = existing_node
        else:
            node = Node(
                name=item["title"],
                normalized_name=node_key,
                type="event",
                severity_score=severity,
                case_id=case_id,
                estimated_loss_usd=dynamic_exposure,
                source="amazon",
                owl_class=owl_class,
                reasoning_path=reasoning_json,
                created_at=now,
                last_seen_at=now,
            )
            db.add(node)
            seen_nodes[node_key] = node


def _load_category_reviews(industry: str) -> list[dict]:
    """Load mock reviews for the given industry category."""
    data_dir = Path(__file__).resolve().parents[1] / "data"
    category_files = {
        "hospital": data_dir / "mock_reviews_hospital.json",
        "finance": data_dir / "mock_reviews_finance.json",
    }
    path = category_files.get(industry)
    if path and path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    # Default: use built-in MOCK_REVIEWS (food/CPG)
    return MOCK_REVIEWS


def ingest_amazon_mock(product_url: str, db: Session, industry: str = "ecommerce") -> dict:  # pylint: disable=too-many-locals
    """Save mock reviews + risk nodes into SQLite. Return summary."""
    reviews_data = _load_category_reviews(industry)
    scan_id = str(uuid.uuid4())
    reviews_saved = 0
    risks_created = 0
    now = datetime.now(timezone.utc)
    seen_nodes: dict[str, Node] = {}

    log_event(
        db, scan_id, AuditEventType.SCAN_STARTED,
        details={
            "product_url": product_url,
            "review_count": len(reviews_data),
            "industry": industry,
        },
    )

    for item in reviews_data:
        existing_review = (
            db.query(Review.id)
            .filter(
                Review.source == "amazon",
                Review.product_url == product_url,
                Review.title == item["title"],
                Review.body == item["body"],
            )
            .first()
        )
        if existing_review:
            continue

        full_text = f"{item['title']} {item['body']}"
        severity, risk_label, ontology_result = _classify_severity(full_text)

        log_event(
            db, scan_id, AuditEventType.REVIEW_CLASSIFIED,
            details={
                "title": item["title"],
                "severity": severity,
                "risk_label": risk_label,
                **({"owl_class": ontology_result["risk_class"],
                    "reasoning_path": ontology_result["reasoning_path"]}
                   if ontology_result else {}),
            },
        )

        review = Review(
            source="amazon",
            product_url=product_url,
            rating=item["rating"],
            title=item["title"],
            body=item["body"],
            severity=severity,
            risk_label=risk_label,
        )
        db.add(review)
        reviews_saved += 1

        if severity < 4.0 or risk_label is None:
            continue

        precedent_result = _match_precedent_for_review(
            full_text, risk_label, item["title"], scan_id, db,
        )

        log_event(
            db, scan_id, AuditEventType.RISK_FLAGGED,
            risk_category=risk_label,
            details={"title": item["title"], "severity": severity},
        )

        _upsert_event_node(
            item, severity, risk_label, precedent_result,
            ontology_result, seen_nodes, now, db,
        )
        risks_created += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        log_event(
            db, scan_id, AuditEventType.SCAN_COMPLETED,
            details={
                "product_url": product_url,
                "reviews_ingested": reviews_saved,
                "risks_detected": risks_created,
                "error": "Transaction commit failed",
            },
        )
        raise

    log_event(
        db, scan_id, AuditEventType.SCAN_COMPLETED,
        details={
            "product_url": product_url,
            "reviews_ingested": reviews_saved,
            "risks_detected": risks_created,
        },
    )

    return {
        "scan_id": scan_id,
        "product_url": product_url,
        "reviews_ingested": reviews_saved,
        "risks_detected": risks_created,
        "source": "amazon (mock)",
    }

"""Amazon mock ingestion — K-Beauty/K-Food reviews with risk tagging.

Saves reviews to the Review table AND creates high-severity Node entries
so the KPI dashboard and risk timeline immediately update.

Pipeline: Review → detect_risk_candidate() → classify_with_llm() → match_precedent()
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from backend.database.models import AuditEventType, Node, Review
from backend.services.audit_service import log_event
from backend.services.legal_rag_service import match_precedent
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
    "lawsuit": "Regulatory & Class Action",
    "fda": "Regulatory & Class Action",
    "recall": "Regulatory & Class Action",
    "sue": "Regulatory & Class Action",
    "choking": "Regulatory & Class Action",
    "reaction": "Product Liability",
    "fake": "Consumer Fraud",
    "scam": "Consumer Fraud",
    "lie": "Consumer Fraud",
    "melt": "Product Liability",
    "contaminated": "Food Safety",
    "expired": "Food Safety",
    "mold": "Food Safety",
    "spoiled": "Food Safety",
    "bacteria": "Food Safety",
    "stomach": "Food Safety",
    "vomit": "Food Safety",
    "diarrhea": "Food Safety",
    "parasite": "Food Safety",
    "counterfeit": "Consumer Fraud",
    "misleading": "Consumer Fraud",
    "deceptive": "Consumer Fraud",
    "swollen": "Product Liability",
    "blister": "Product Liability",
    "hives": "Product Liability",
    "banned": "Regulatory & Class Action",
    "prohibited": "Regulatory & Class Action",
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
    # ── Existing 10 reviews ──────────────────────────────────────────────
    {
        "rating": 1,
        "title": "Caused severe rash on my face",
        "body": (
            "I used this K-Beauty snail mucin serum for two days and developed a severe rash "
            "across my cheeks and forehead. Had to go to urgent care. This should NOT be sold "
            "without proper FDA testing. Considering a lawsuit against the seller."
        ),
    },
    {
        "rating": 1,
        "title": "Chemical burn from this product",
        "body": (
            "This Korean skincare toner gave me a chemical burn. My dermatologist said the "
            "pH level is dangerously low. I ended up in the hospital ER. This product needs "
            "an immediate recall."
        ),
    },
    {
        "rating": 1,
        "title": "Allergic reaction — DO NOT BUY",
        "body": (
            "Severe allergic reaction after using this K-Beauty sheet mask. My eyes swelled shut "
            "and I had to use an EpiPen. The ingredients list doesn't even match what's in the "
            "product. Toxic chemicals not disclosed. Filing FDA complaint."
        ),
    },
    {
        "rating": 2,
        "title": "Kimchi arrived spoiled and smelled terrible",
        "body": (
            "The K-Food kimchi arrived with a bloated bag and smelled like it was fermenting "
            "way too long. Concerned about food safety. Other Amazon reviews mention similar "
            "issues — possible cold-chain failure."
        ),
    },
    {
        "rating": 2,
        "title": "Gochujang paste leaked everywhere",
        "body": (
            "Packaging was terrible. The gochujang container leaked inside the box. Everything "
            "was sticky and ruined. Product itself tasted off compared to what I buy at H-Mart. "
            "Disappointing quality control."
        ),
    },
    {
        "rating": 3,
        "title": "Sheet mask is okay but nothing special",
        "body": (
            "This K-Beauty collagen mask is average. Doesn't feel as hydrating as Korean brands "
            "I buy from Olive Young directly. Overpriced for what you get. Not bad, just meh."
        ),
    },
    {
        "rating": 4,
        "title": "Love this sunscreen but shipping was slow",
        "body": (
            "The Korean sunscreen SPF50 is amazing — lightweight, no white cast. Only issue "
            "is it took 3 weeks to arrive. Would buy again if shipping improves."
        ),
    },
    {
        "rating": 5,
        "title": "Best tteokbokki sauce ever!",
        "body": (
            "Authentic Korean rice cake sauce! Tastes exactly like what I had in Seoul. "
            "Perfect spice level. Already ordered 3 more bottles for friends."
        ),
    },
    {
        "rating": 3,
        "title": "Expiration date concerns",
        "body": (
            "The K-Food ramen bundle arrived with only 2 months until expiration. For the price "
            "I paid, I expected at least 6 months. Feels like they're dumping old stock on "
            "Amazon. Not cool."
        ),
    },
    {
        "rating": 1,
        "title": "Fake product — not the real Korean brand",
        "body": (
            "This is NOT genuine Sulwhasoo. The packaging is different, the texture is wrong, "
            "and it irritated my skin. This seller is selling counterfeit K-Beauty products. "
            "Amazon needs to crack down on this. Reporting to FTC."
        ),
    },
    # ── 40 new reviews (11-50) ───────────────────────────────────────────
    # Rating 1 — Product Liability
    {
        "rating": 1,
        "title": "Sunscreen caused blisters on my neck",
        "body": (
            "Applied this Korean SPF50 sunscreen before going to the beach and within an hour "
            "I had painful blister patches all over my neck. I've never reacted to any sunscreen "
            "before. Had to visit urgent care and missed two days of work."
        ),
    },
    {
        "rating": 1,
        "title": "Serum left a permanent scar",
        "body": (
            "This vitamin C serum from a K-Beauty brand left a dark scar on my jawline after "
            "only three uses. My dermatologist confirmed it was a chemical injury from the product. "
            "I'm documenting everything for a potential lawsuit."
        ),
    },
    {
        "rating": 1,
        "title": "Snail cream gave me hives all over",
        "body": (
            "Within minutes of applying this Korean snail cream my arms and face broke out in "
            "hives. My throat started feeling tight and I had to take Benadryl immediately. "
            "There is no allergen warning on the label — this is dangerous."
        ),
    },
    {
        "rating": 1,
        "title": "Eye cream caused swollen eyelids for a week",
        "body": (
            "My eyelids became extremely swollen after using this K-Beauty eye cream twice. "
            "I looked like I had been stung by bees. The ophthalmologist said the fragrance "
            "ingredients are known irritants. This needs to be pulled from shelves."
        ),
    },
    # Rating 1 — Regulatory & Class Action
    {
        "rating": 1,
        "title": "Contains ingredients banned in the US",
        "body": (
            "I checked the ingredient list against the FDA database and this K-Beauty toner "
            "contains hydroquinone above the permitted concentration. This ingredient is banned "
            "at this level without a prescription. How is Amazon allowing this to be sold?"
        ),
    },
    {
        "rating": 1,
        "title": "Class action waiting to happen",
        "body": (
            "This Korean whitening cream contains mercury — I had it tested at a lab. Multiple "
            "people in the reviews are reporting skin reactions. Someone needs to sue this company "
            "and get a recall going. I've already filed an FDA complaint."
        ),
    },
    {
        "rating": 1,
        "title": "Baby food with choking hazard pieces",
        "body": (
            "Bought this Korean baby rice snack for my 10-month-old and found hard chunks that "
            "are a clear choking hazard. The packaging says suitable from 6 months. This is "
            "negligent and I'm reporting it to the CPSC for an immediate recall."
        ),
    },
    # Rating 1 — Consumer Fraud
    {
        "rating": 1,
        "title": "Totally fake — counterfeit Laneige product",
        "body": (
            "This is 100% a counterfeit Laneige sleeping mask. The texture is like glue, the "
            "scent is chemical, and the batch code doesn't exist on Laneige's verification site. "
            "This is a scam and the seller should be banned from Amazon."
        ),
    },
    {
        "rating": 1,
        "title": "Deceptive labeling on this serum",
        "body": (
            "The listing says '95% hyaluronic acid' but I had the serum tested and it's mostly "
            "water with trace amounts. This is deceptive marketing at its worst. The before/after "
            "photos are clearly photoshopped too. Complete lie."
        ),
    },
    # Rating 1 — Food Safety
    {
        "rating": 1,
        "title": "Found mold inside sealed ramen packets",
        "body": (
            "Opened a pack of Korean instant ramen and found visible mold on the noodle block "
            "inside the sealed wrapper. Checked the other four packs — two more had mold. "
            "This is a serious food safety issue and I've reported it to the FDA."
        ),
    },
    {
        "rating": 1,
        "title": "Kimchi gave our whole family food poisoning",
        "body": (
            "My entire family of four got severe vomit and diarrhea within hours of eating "
            "this kimchi. We ended up in the ER and the doctor suspects bacteria contamination. "
            "The container was bulging when it arrived — clearly contaminated."
        ),
    },
    # Rating 2 — Product Liability
    {
        "rating": 2,
        "title": "Sheet mask irritated my sensitive skin badly",
        "body": (
            "I have sensitive skin and this K-Beauty sheet mask caused an immediate burn "
            "sensation that lasted for hours. The redness didn't go away for three days. "
            "There really should be a stronger warning on the packaging."
        ),
    },
    {
        "rating": 2,
        "title": "Lip tint caused allergic swelling",
        "body": (
            "My lips became swollen and cracked after using this Korean lip tint. I've used "
            "dozens of lip products without any allergy issues before. Something in this "
            "formula is not right. Very disappointed and slightly scared."
        ),
    },
    {
        "rating": 2,
        "title": "AHA peel left a chemical burn mark",
        "body": (
            "Used this K-Beauty AHA peeling gel as directed and woke up with a visible burn "
            "mark on my cheek. The concentration must be way higher than what's listed. "
            "Two weeks later and the mark is still there. Considering seeing a lawyer."
        ),
    },
    # Rating 2 — Regulatory & Class Action
    {
        "rating": 2,
        "title": "No English ingredient list — is this even legal?",
        "body": (
            "This Korean serum has zero English on the label. No ingredient list, no warnings, "
            "no directions. Pretty sure the FDA requires English labeling for cosmetics sold "
            "in the US. How did this pass Amazon's review process?"
        ),
    },
    {
        "rating": 2,
        "title": "Prohibited preservatives found",
        "body": (
            "I ran this K-Beauty moisturizer through an ingredient checker and it contains "
            "formaldehyde releasers that are prohibited in the EU and restricted by the FDA. "
            "The brand doesn't disclose this on the listing. Buyers beware."
        ),
    },
    # Rating 2 — Food Safety
    {
        "rating": 2,
        "title": "Gochujang was expired on arrival",
        "body": (
            "Received this Korean gochujang paste and it was already two months expired. "
            "The color looked darker than normal and it smelled fermented in a bad way. "
            "Returned it immediately. Amazon needs better inventory controls."
        ),
    },
    {
        "rating": 2,
        "title": "Dried seaweed snack had strange white spots",
        "body": (
            "These Korean roasted seaweed snacks had white fuzzy spots that look like mold "
            "on several sheets. The best-by date is still months away so this shouldn't happen. "
            "Not risking it — threw the whole box away."
        ),
    },
    # Rating 2 — Consumer Fraud
    {
        "rating": 2,
        "title": "Not the same product shown in photos",
        "body": (
            "The K-Beauty essence I received looks nothing like the listing photos. Different "
            "bottle shape, different color liquid, and a misleading product description. "
            "Either this is a fake or the listing is intentionally deceptive."
        ),
    },
    # Rating 3 — Product Liability
    {
        "rating": 3,
        "title": "Mild rash but it went away",
        "body": (
            "Got a slight rash on my wrist after patch-testing this Korean cream. It cleared "
            "up after a day so I tried it again with the same result. Not terrible but worth "
            "mentioning for people with reactive skin."
        ),
    },
    {
        "rating": 3,
        "title": "Sunscreen melted in normal room temperature",
        "body": (
            "This K-Beauty sunscreen started to melt and separate just sitting on my bathroom "
            "counter. The formula clearly isn't stable. It also left a slight burn feeling "
            "when I applied it to my face. Wouldn't repurchase."
        ),
    },
    # Rating 3 — Regulatory & Class Action
    {
        "rating": 3,
        "title": "SPF claims seem exaggerated",
        "body": (
            "I used this Korean sunscreen labeled SPF50+ and still got sunburned after an hour "
            "outdoors. The FDA should investigate these SPF claims because I don't think this "
            "product was tested by US standards. Mediocre at best."
        ),
    },
    # Rating 3 — Consumer Fraud
    {
        "rating": 3,
        "title": "Packaging looks different from Korean version",
        "body": (
            "Compared this to the same product I bought in Korea and the packaging, texture, "
            "and scent are all different. I suspect this might be a counterfeit or a lower-grade "
            "export version. Hard to tell but it feels misleading."
        ),
    },
    {
        "rating": 3,
        "title": "Inflated review count — seems like a scam",
        "body": (
            "This K-Beauty brand has thousands of five-star reviews but most of them read like "
            "they were written by the same person. The product itself is just okay — nothing "
            "like what the fake reviews promise. Feels like a scam operation."
        ),
    },
    # Rating 3 — Food Safety
    {
        "rating": 3,
        "title": "Tteokbokki sauce tasted off",
        "body": (
            "The color was way darker than the tteokbokki sauce I usually buy and it had a "
            "slightly spoiled aftertaste. Not sure if it was a bad batch or improper storage "
            "during shipping. Edible but I wouldn't serve it to guests."
        ),
    },
    {
        "rating": 3,
        "title": "Instant rice cakes arrived partially opened",
        "body": (
            "The vacuum seal on two of the five rice cake packs was broken. They looked okay "
            "but I'm worried about bacteria growth since they weren't properly sealed. "
            "Ate one and it was fine but threw away the opened ones."
        ),
    },
    {
        "rating": 3,
        "title": "Soju bottle caps were loose",
        "body": (
            "Three of the six soju bottles arrived with loose caps and some liquid had leaked "
            "out. The seals didn't look tampered with but it makes you wonder about contaminated "
            "contents. Tasted fine though so maybe just a packaging issue."
        ),
    },
    # Rating 4 — Product Liability
    {
        "rating": 4,
        "title": "Great serum but tingling is concerning",
        "body": (
            "This K-Beauty niacinamide serum works well for my pores, but I notice a strong "
            "tingling sensation every time I apply it. Wouldn't call it a burn exactly, but "
            "it's more than I'd expect. Knocked off a star for that."
        ),
    },
    {
        "rating": 4,
        "title": "Cushion compact is lovely but caused mild reaction",
        "body": (
            "The coverage and finish of this Korean cushion compact are gorgeous. However after "
            "a week of daily use I developed a mild allergic reaction around my nose. Switched "
            "to using it only occasionally and the issue stopped."
        ),
    },
    # Rating 4 — Regulatory & Class Action
    {
        "rating": 4,
        "title": "Good moisturizer but ingredient list is suspect",
        "body": (
            "I love how this K-Beauty moisturizer feels but I noticed the ingredient list on "
            "Amazon doesn't match what's printed on the jar. The FDA requires accurate labeling "
            "so this is a red flag. Product itself works great though."
        ),
    },
    # Rating 4 — Food Safety
    {
        "rating": 4,
        "title": "Delicious ramyeon but packaging could be better",
        "body": (
            "The Korean spicy ramyeon itself is amazing — rich broth, perfect noodles. But "
            "one out of five packs had a tiny tear and the noodles looked slightly expired "
            "in color. Ate the good ones and they were fantastic."
        ),
    },
    # Rating 4 — Safe/Positive
    {
        "rating": 4,
        "title": "Really good Korean sunscreen overall",
        "body": (
            "Lightweight, no white cast, absorbs fast. This is one of the best sunscreens I've "
            "tried. Only reason for 4 stars is it pills a bit under makeup. Would still recommend "
            "to anyone looking for a good daily SPF."
        ),
    },
    {
        "rating": 4,
        "title": "Solid gochujang — close to authentic",
        "body": (
            "This Korean chili paste is really close to what I had in Seoul. Great depth of "
            "flavor and just the right amount of heat. Jar is a bit small for the price but "
            "the quality makes up for it."
        ),
    },
    {
        "rating": 4,
        "title": "Nice sheet masks for the price",
        "body": (
            "These K-Beauty sheet masks are a great value. Skin feels hydrated and plump the "
            "next morning. The fit could be better for wider faces but overall very happy "
            "with this purchase. Will reorder."
        ),
    },
    # Rating 5 — Safe/Positive
    {
        "rating": 5,
        "title": "Holy grail K-Beauty find!",
        "body": (
            "This Korean double-cleansing oil is everything. Takes off waterproof mascara like "
            "magic and leaves my skin soft, not stripped. I've already converted three friends. "
            "This is now a permanent part of my routine."
        ),
    },
    {
        "rating": 5,
        "title": "Kimchi perfection in a jar",
        "body": (
            "Finally found authentic-tasting kimchi on Amazon! Perfect crunch, great fermentation "
            "level, and the spice is on point. Tastes just like homemade. Already on my "
            "Subscribe & Save list."
        ),
    },
    {
        "rating": 5,
        "title": "Best Korean instant ramyeon on Amazon",
        "body": (
            "If you love spicy noodles this is it. The broth is rich, the noodles are chewy, "
            "and the heat builds perfectly. Way better than any American instant ramen. "
            "Stocked up with a 20-pack and no regrets."
        ),
    },
    {
        "rating": 5,
        "title": "Soju cocktail night was a hit",
        "body": (
            "Ordered this soju variety pack for a Korean BBQ party and everyone loved it. "
            "The peach and grape flavors are smooth and easy to drink. Great price compared "
            "to my local Korean grocery store."
        ),
    },
    {
        "rating": 5,
        "title": "COSRX snail mucin is worth the hype",
        "body": (
            "I was skeptical about putting snail goo on my face but this stuff is incredible. "
            "My acne scars have faded noticeably in just a month. Lightweight, non-greasy, and "
            "layers perfectly under sunscreen. 10/10."
        ),
    },
    {
        "rating": 5,
        "title": "Tteokbokki kit was so fun to make",
        "body": (
            "This Korean rice cake kit had everything we needed — chewy tteok, sauce packet, "
            "and fish cake. Took 15 minutes and tasted restaurant-quality. Perfect for a "
            "weeknight dinner. Kids absolutely loved it."
        ),
    },
]


def _classify_severity(text: str) -> tuple[float, str | None]:
    """Return (severity_score, risk_label) using LLM classification.

    Pipeline:
    1. detect_risk_candidate() → Fast keyword filter
    2. classify_with_llm() → LLM-based classification (only for candidates)
    3. Return severity and risk category

    Stability: Always returns safe fallback on any failure.
    """
    # Fast path: skip LLM for non-candidate reviews
    if not detect_risk_candidate(text):
        return 2.0, None

    # LLM classification for risk candidates
    try:
        classification = classify_with_llm(text)
        severity = classification["severity"]
        risk_category = classification["risk_category"]

        # Map risk_category to display label
        if risk_category == "Safe":
            return severity, None

        # Use risk_category as the label (matches legal_cases.json categories)
        return severity, risk_category

    except Exception as e:  # pylint: disable=broad-except
        # Fallback to simple keyword matching if LLM fails
        logger.warning("LLM classification failed, using keyword fallback: %s", e)
        lower = text.lower()
        for keyword, label in _HIGH_RISK_KEYWORDS.items():
            if re.search(rf"\b{keyword}\b", lower):
                return 9.0, label
        return 2.0, None


def ingest_amazon_mock(product_url: str, db: Session) -> dict:  # pylint: disable=too-many-locals,too-many-statements
    """Save 50 mock Amazon reviews + risk nodes into SQLite. Return summary."""
    scan_id = str(uuid.uuid4())
    reviews_saved = 0
    risks_created = 0
    now = datetime.now(timezone.utc)
    # Track nodes created in this run to avoid UNIQUE constraint violations
    seen_nodes: dict[str, Node] = {}

    log_event(
        db, scan_id, AuditEventType.SCAN_STARTED,
        details={
            "product_url": product_url,
            "review_count": len(MOCK_REVIEWS),
        },
    )

    for item in MOCK_REVIEWS:
        # Check for duplicate review (idempotency)
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
        severity, risk_label = _classify_severity(full_text)

        log_event(
            db, scan_id, AuditEventType.REVIEW_CLASSIFIED,
            details={
                "title": item["title"],
                "severity": severity,
                "risk_label": risk_label,
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

        # Only process legal RAG for severity >= 4 (skip Safe reviews)
        if severity < 4.0 or risk_label is None:
            continue

        # Create or update a Node for medium+ severity reviews
        if severity >= 4.0:
            try:
                precedent_result = match_precedent(
                    full_text, risk_category=risk_label,
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning(
                    "Precedent matching failed for '%s': %s",
                    item["title"], exc,
                )
                precedent_result = None
            if precedent_result:
                log_event(
                    db, scan_id,
                    AuditEventType.PRECEDENT_MATCHED,
                    details={
                        "title": item["title"],
                        "risk_category": risk_label,
                        "case_title": precedent_result[
                            "primary_match"
                        ].get("case_title"),
                        "expected_exposure_usd": precedent_result[
                            "expected_exposure_usd"
                        ],
                    },
                )

            log_event(
                db, scan_id, AuditEventType.RISK_FLAGGED,
                risk_category=risk_label,
                details={
                    "title": item["title"],
                    "severity": severity,
                },
            )

            # Dynamic Legal Exposure using confidence-weighted expected
            if precedent_result:
                primary = precedent_result["primary_match"]
                expected_exposure = precedent_result["expected_exposure_usd"]
                # Scale by severity (0-10 normalized to 0-1)
                dynamic_exposure = int(expected_exposure * (severity / 10.0))
                case_id = primary["case_id"]
            else:
                dynamic_exposure = 0
                case_id = None

            normalized = (risk_label or "unknown risk").strip().lower()
            node_key = f"{normalized}::event"

            if node_key in seen_nodes:
                # Already created in this run — just update
                existing_node = seen_nodes[node_key]
                existing_node.severity_score = max(existing_node.severity_score or 0, severity)
                existing_node.last_seen_at = now
                if precedent_result:
                    existing_node.case_id = case_id
                    existing_node.estimated_loss_usd = max(
                        existing_node.estimated_loss_usd or 0, dynamic_exposure
                    )
            else:
                # Check DB for pre-existing node
                existing_node = (
                    db.query(Node)
                    .filter(Node.normalized_name == normalized, Node.type == "event")
                    .first()
                )
                if existing_node:
                    existing_node.severity_score = max(existing_node.severity_score or 0, severity)
                    existing_node.last_seen_at = now
                    if precedent_result:
                        existing_node.case_id = case_id
                        existing_node.estimated_loss_usd = max(
                            existing_node.estimated_loss_usd or 0, dynamic_exposure
                        )
                    seen_nodes[node_key] = existing_node
                else:
                    node = Node(
                        name=risk_label or "Unknown Risk",
                        normalized_name=normalized,
                        type="event",
                        severity_score=severity,
                        case_id=case_id,
                        estimated_loss_usd=dynamic_exposure,
                        source="amazon",
                        created_at=now,
                        last_seen_at=now,
                    )
                    db.add(node)
                    seen_nodes[node_key] = node
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

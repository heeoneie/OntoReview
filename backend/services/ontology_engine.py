"""OWL-based Ontology Reasoning Engine — owlready2 integration.

Defines a formal OWL class hierarchy for risk classification with SWRL-like
inference rules. Scans accumulate instances into the ontology, strengthening
detection over time.

Architecture:
  init_ontology()           — Build OWL schema (once at startup)
  classify_with_ontology()  — Map LLM result → OWL class + run inference
  add_risk_instance()       — Add a new risk instance (knowledge accumulation)
  get_reasoning_path()      — Return inference chain for visualization
  owl_to_reactflow()        — Convert OWL ontology → ReactFlow JSON
"""

import logging
import threading
from datetime import datetime, timezone

from owlready2 import (
    DataProperty,
    FunctionalProperty,
    ObjectProperty,
    Thing,
    get_ontology,
)

logger = logging.getLogger(__name__)

# Thread-safe singleton
_lock = threading.Lock()
_onto = None  # pylint: disable=invalid-name

# ──────────────────────────────────────────────
#  OWL Schema Definition
# ──────────────────────────────────────────────

_OWL_IRI = "http://ontoreview.ai/risk-ontology#"


def _build_schema():  # pylint: disable=too-many-locals
    """Create OWL class hierarchy, properties, and inference rules."""
    onto = get_ontology(_OWL_IRI)

    with onto:  # noqa — owlready2 registers classes via metaclass; pylint sees them as unused
        # ── Top-level classes ──
        class RiskEvent(Thing):
            pass

        class LegalCase(Thing):
            pass

        class Department(Thing):
            pass

        class Regulation(Thing):
            pass

        class RootCause(Thing):
            pass

        # pylint: disable=unused-variable,invalid-name
        # owlready2 registers these classes/properties via metaclass at definition time.

        # ── ProductLiability subtree ──
        class ProductLiability(RiskEvent):
            pass

        class SkinReaction(ProductLiability):
            pass

        class ChemicalBurn(ProductLiability):
            pass

        class Ingestion(ProductLiability):
            pass

        class Choking(ProductLiability):
            pass

        # ── RegulatoryRisk subtree ──
        class RegulatoryRisk(RiskEvent):
            pass

        class FDAViolation(RegulatoryRisk):
            pass

        class RecallEvent(RegulatoryRisk):
            pass

        class ClassAction(RegulatoryRisk):
            pass

        # ── ConsumerFraud subtree ──
        class ConsumerFraud(RiskEvent):
            pass

        class Counterfeit(ConsumerFraud):
            pass

        class MisleadingLabel(ConsumerFraud):
            pass

        # ── FoodSafety subtree ──
        class FoodSafety(RiskEvent):
            pass

        class Contamination(FoodSafety):
            pass

        class Expiration(FoodSafety):
            pass

        class Allergen(FoodSafety):
            pass

        # ── Object Properties (relations) ──
        class has_legal_precedent(ObjectProperty):
            domain = [RiskEvent]
            range = [LegalCase]

        class affects_department(ObjectProperty):
            domain = [RiskEvent]
            range = [Department]

        class triggers_regulation(ObjectProperty):
            domain = [RiskEvent]
            range = [Regulation]

        class caused_by(ObjectProperty):
            domain = [RiskEvent]
            range = [RootCause]

        class may_escalate_to(ObjectProperty):
            domain = [RiskEvent]
            range = [RiskEvent]

        # ── Data Properties ──
        class has_severity(DataProperty, FunctionalProperty):
            domain = [RiskEvent]
            range = [float]

        class has_channel(DataProperty, FunctionalProperty):
            domain = [RiskEvent]
            range = [str]

        class has_occurrence_count(DataProperty, FunctionalProperty):
            domain = [RiskEvent]
            range = [int]

        class has_timestamp(DataProperty, FunctionalProperty):
            domain = [RiskEvent]
            range = [str]

        # ── Pre-populate Departments ──
        for dept_name in ["Legal", "QualityControl", "CustomerService",
                          "Regulatory", "PR", "Executive", "ProductDev"]:
            Department(dept_name)

        # ── Pre-populate Regulations ──
        for reg_name in ["FDA_Cosmetics", "FDA_Food", "CPSC_Safety",
                         "FTC_Advertising", "StateConsumerProtection"]:
            Regulation(reg_name)

    return onto


# ──────────────────────────────────────────────
#  Keyword → OWL Class Mapping
# ──────────────────────────────────────────────

# Maps keywords found in review text to OWL class names
_KEYWORD_TO_OWL_CLASS = {
    # SkinReaction
    "rash": "SkinReaction",
    "hives": "SkinReaction",
    "allergic": "SkinReaction",
    "allergy": "SkinReaction",
    "swollen": "SkinReaction",
    "irritat": "SkinReaction",
    # ChemicalBurn
    "burn": "ChemicalBurn",
    "blister": "ChemicalBurn",
    "scar": "ChemicalBurn",
    # Ingestion
    "vomit": "Ingestion",
    "diarrhea": "Ingestion",
    "stomach": "Ingestion",
    "parasite": "Ingestion",
    # Choking
    "choking": "Choking",
    "chok": "Choking",
    # FDAViolation
    "fda": "FDAViolation",
    "banned": "FDAViolation",
    "prohibited": "FDAViolation",
    "hydroquinone": "FDAViolation",
    "mercury": "FDAViolation",
    # RecallEvent
    "recall": "RecallEvent",
    # ClassAction
    "lawsuit": "ClassAction",
    "class action": "ClassAction",
    "sue": "ClassAction",
    # Counterfeit
    "counterfeit": "Counterfeit",
    "fake": "Counterfeit",
    # MisleadingLabel
    "misleading": "MisleadingLabel",
    "deceptive": "MisleadingLabel",
    "scam": "MisleadingLabel",
    # Contamination
    "contaminated": "Contamination",
    "mold": "Contamination",
    "bacteria": "Contamination",
    "spoiled": "Contamination",
    # Expiration
    "expired": "Expiration",
    "expiration": "Expiration",
    # Allergen
    "allergen": "Allergen",
    "epipen": "Allergen",
}

# LLM risk_category string → OWL class name
_CATEGORY_TO_OWL_CLASS = {
    "Product Liability": "ProductLiability",
    "Regulatory Risk": "RegulatoryRisk",
    "Class Action Risk": "ClassAction",
    "Consumer Safety": "FoodSafety",
    "False Advertising": "ConsumerFraud",
    "Food Safety": "FoodSafety",
}

# OWL class → default departments
_CLASS_TO_DEPARTMENTS = {
    "ProductLiability": ["Legal", "QualityControl", "ProductDev"],
    "SkinReaction": ["Legal", "QualityControl", "CustomerService"],
    "ChemicalBurn": ["Legal", "QualityControl", "Regulatory"],
    "Ingestion": ["Legal", "QualityControl", "CustomerService"],
    "Choking": ["Legal", "QualityControl", "Regulatory"],
    "RegulatoryRisk": ["Legal", "Regulatory"],
    "FDAViolation": ["Legal", "Regulatory", "Executive"],
    "RecallEvent": ["Legal", "Regulatory", "PR", "Executive"],
    "ClassAction": ["Legal", "Executive", "PR"],
    "ConsumerFraud": ["Legal", "CustomerService"],
    "Counterfeit": ["Legal", "CustomerService"],
    "MisleadingLabel": ["Legal", "Regulatory"],
    "FoodSafety": ["Legal", "QualityControl"],
    "Contamination": ["Legal", "QualityControl", "Regulatory"],
    "Expiration": ["QualityControl", "CustomerService"],
    "Allergen": ["Legal", "QualityControl", "Regulatory"],
}

# OWL class → default regulations
_CLASS_TO_REGULATIONS = {
    "SkinReaction": ["FDA_Cosmetics"],
    "ChemicalBurn": ["FDA_Cosmetics"],
    "FDAViolation": ["FDA_Cosmetics", "FDA_Food"],
    "RecallEvent": ["CPSC_Safety"],
    "ClassAction": ["StateConsumerProtection"],
    "Counterfeit": ["FTC_Advertising"],
    "MisleadingLabel": ["FTC_Advertising"],
    "Contamination": ["FDA_Food", "CPSC_Safety"],
    "Expiration": ["FDA_Food"],
    "Allergen": ["FDA_Food", "FDA_Cosmetics"],
    "Choking": ["CPSC_Safety"],
    "Ingestion": ["FDA_Food"],
}


# ──────────────────────────────────────────────
#  Public API
# ──────────────────────────────────────────────

def init_ontology():
    """Initialize OWL ontology schema. Call once at app startup."""
    global _onto  # pylint: disable=global-statement
    with _lock:
        if _onto is not None:
            return _onto
        logger.info("Initializing OWL ontology schema...")
        _onto = _build_schema()
        logger.info(
            "OWL ontology ready — %d classes, %d properties",
            len(list(_onto.classes())),
            len(list(_onto.properties())),
        )
        return _onto


def _get_onto():
    """Get ontology, initializing if needed."""
    if _onto is None:
        return init_ontology()
    return _onto


def _detect_owl_class(text: str, llm_category: str | None = None) -> str:
    """Determine the most specific OWL class from text + LLM category."""
    lower = text.lower()

    # First try keyword matching for specific subclass
    best_class = None
    for keyword, owl_cls in _KEYWORD_TO_OWL_CLASS.items():
        if keyword in lower:
            best_class = owl_cls
            break  # Take first match (ordered by specificity)

    # Fall back to LLM category mapping
    if best_class is None and llm_category:
        best_class = _CATEGORY_TO_OWL_CLASS.get(llm_category, "RiskEvent")

    return best_class or "RiskEvent"


def _get_class_hierarchy(onto, class_name: str) -> list[str]:
    """Return list of class names from specific → general."""
    cls = onto[class_name]
    if cls is None:
        return [class_name]
    hierarchy = [class_name]
    for ancestor in cls.ancestors():
        name = ancestor.name
        if name not in ("Thing", class_name) and name != "object":
            hierarchy.append(name)
    return hierarchy


def _count_class_instances(onto, class_name: str) -> int:
    """Count instances of a given OWL class."""
    cls = onto[class_name]
    if cls is None:
        return 0
    return len(list(cls.instances()))


def classify_with_ontology(text: str, llm_result: dict) -> dict:  # pylint: disable=too-many-locals
    """Classify a review using OWL ontology + inference rules.

    Args:
        text: Review text (title + body)
        llm_result: Dict with keys like severity, risk_category from LLM

    Returns:
        Dict with risk_class, inferred_regulations, affected_departments,
        severity, reasoning_path, is_inferred
    """
    onto = _get_onto()

    llm_severity = llm_result.get("severity", 5.0)
    llm_category = llm_result.get("risk_category")
    channel = llm_result.get("channel", "amazon")

    # Step 1: Map to OWL class
    owl_class_name = _detect_owl_class(text, llm_category)
    hierarchy = _get_class_hierarchy(onto, owl_class_name)

    # Step 2: Determine departments and regulations from class mapping
    departments = set()
    regulations = set()
    for cls_name in hierarchy:
        departments.update(_CLASS_TO_DEPARTMENTS.get(cls_name, []))
        regulations.update(_CLASS_TO_REGULATIONS.get(cls_name, []))

    # Step 3: Apply inference rules
    reasoning_path = []
    adjusted_severity = llm_severity
    inferred_risks = []

    # Rule 1: SkinReaction + severity > 7 → triggers FDA
    if owl_class_name in ("SkinReaction", "ChemicalBurn", "Allergen") and llm_severity > 7:
        regulations.add("FDA_Cosmetics")
        departments.add("Regulatory")
        reasoning_path.append(
            f"RULE: {owl_class_name} + severity {llm_severity:.1f} > 7 "
            f"→ triggers FDA_Cosmetics regulation"
        )

    # Rule 2: Contamination + channel == "amazon" → triggers CPSC
    if owl_class_name in ("Contamination", "Expiration", "Ingestion") and channel == "amazon":
        regulations.add("CPSC_Safety")
        reasoning_path.append(
            f"RULE: {owl_class_name} + channel=amazon → triggers CPSC_Safety regulation"
        )

    # Rule 3: Same RiskEvent ≥ 3 occurrences → severity auto-upgrade
    occurrence_count = _count_class_instances(onto, owl_class_name)
    if occurrence_count >= 3:
        severity_boost = min(2.0, occurrence_count * 0.3)
        adjusted_severity = min(10.0, llm_severity + severity_boost)
        reasoning_path.append(
            f"RULE: {owl_class_name} has {occurrence_count} prior instances "
            f"→ severity boosted {llm_severity:.1f} → {adjusted_severity:.1f}"
        )

    # Rule 4: ProductLiability + FDAViolation → ClassAction possibility
    if "ProductLiability" in hierarchy:
        # Check if there are existing FDAViolation instances
        fda_count = _count_class_instances(onto, "FDAViolation")
        if fda_count > 0 or "FDAViolation" in hierarchy:
            inferred_risks.append("ClassAction")
            departments.add("Executive")
            reasoning_path.append(
                f"RULE: ProductLiability + FDAViolation ({fda_count} instances) "
                f"→ ClassAction risk inferred"
            )

    # Rule 5: High severity food contamination → Executive escalation
    if owl_class_name in ("Contamination", "Ingestion") and adjusted_severity >= 8:
        departments.add("Executive")
        regulations.add("FDA_Food")
        reasoning_path.append(
            f"RULE: {owl_class_name} + severity {adjusted_severity:.1f} ≥ 8 "
            f"→ Executive escalation + FDA_Food"
        )

    # Add class hierarchy as reasoning context
    if len(hierarchy) > 1:
        reasoning_path.insert(
            0,
            f"OWL: {owl_class_name} isa {' → '.join(hierarchy[1:])}"
        )

    return {
        "risk_class": owl_class_name,
        "owl_hierarchy": hierarchy,
        "inferred_regulations": sorted(regulations),
        "inferred_risks": inferred_risks,
        "affected_departments": sorted(departments),
        "severity": round(adjusted_severity, 1),
        "severity_original": llm_severity,
        "reasoning_path": reasoning_path,
        "is_inferred": len(reasoning_path) > 1,
        "instance_count": occurrence_count + 1,  # Including this one
    }


def add_risk_instance(risk_data: dict) -> str | None:
    """Add a new risk event as an OWL instance. Returns instance name or None.

    This accumulates knowledge — more instances strengthen future detection
    via occurrence-count rules.
    """
    onto = _get_onto()
    owl_class_name = risk_data.get("risk_class", "RiskEvent")

    cls = onto[owl_class_name]
    if cls is None:
        logger.warning("OWL class '%s' not found, using RiskEvent", owl_class_name)
        cls = onto["RiskEvent"]

    # Create unique instance name
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    instance_name = f"{owl_class_name}_{timestamp}"

    with onto:
        instance = cls(instance_name)

        # Set data properties (owlready2 uses list for non-functional)
        severity = risk_data.get("severity", 5.0)
        instance.has_severity = float(severity)

        channel = risk_data.get("channel", "unknown")
        instance.has_channel = str(channel)

        count = risk_data.get("instance_count", 1)
        instance.has_occurrence_count = int(count)

        instance.has_timestamp = datetime.now(timezone.utc).isoformat()

        # Set object properties — link to departments
        for dept_name in risk_data.get("affected_departments", []):
            dept = onto[dept_name]
            if dept:
                instance.affects_department.append(dept)

        # Set object properties — link to regulations
        for reg_name in risk_data.get("inferred_regulations", []):
            reg = onto[reg_name]
            if reg:
                instance.triggers_regulation.append(reg)

    logger.debug(
        "OWL instance added: %s (class=%s, severity=%.1f)",
        instance_name, owl_class_name, severity,
    )
    return instance_name


def get_reasoning_path(risk_class: str) -> list[dict]:
    """Return structured reasoning path for a risk class (for visualization).

    Returns list of steps showing class hierarchy, applicable rules,
    and connected regulations/departments.
    """
    onto = _get_onto()
    hierarchy = _get_class_hierarchy(onto, risk_class)
    instance_count = _count_class_instances(onto, risk_class)

    path = []

    # Step 1: Class hierarchy
    path.append({
        "step": "classification",
        "type": "owl_hierarchy",
        "description": f"{risk_class} classified via OWL class hierarchy",
        "details": " → ".join(hierarchy),
    })

    # Step 2: Knowledge accumulation
    path.append({
        "step": "accumulation",
        "type": "instance_count",
        "description": f"{instance_count} prior instances of {risk_class} in ontology",
        "details": f"Occurrence threshold: {'EXCEEDED (≥3)' if instance_count >= 3 else 'normal'}",
    })

    # Step 3: Regulations
    regs = set()
    for cls_name in hierarchy:
        regs.update(_CLASS_TO_REGULATIONS.get(cls_name, []))
    if regs:
        path.append({
            "step": "regulation",
            "type": "triggered_regulations",
            "description": f"Triggers {len(regs)} regulation(s)",
            "details": ", ".join(sorted(regs)),
        })

    # Step 4: Departments
    depts = set()
    for cls_name in hierarchy:
        depts.update(_CLASS_TO_DEPARTMENTS.get(cls_name, []))
    if depts:
        path.append({
            "step": "escalation",
            "type": "affected_departments",
            "description": f"Affects {len(depts)} department(s)",
            "details": ", ".join(sorted(depts)),
        })

    return path


def owl_to_reactflow(min_severity: float = 0.0) -> dict:  # pylint: disable=too-many-locals,too-many-branches,too-many-statements
    """Convert current OWL ontology state to ReactFlow-compatible JSON.

    Returns dict with 'nodes' and 'edges' arrays suitable for the
    OntologyGraph component.
    """
    onto = _get_onto()
    nodes = []
    edges = []
    node_id_map = {}  # class_name → node_id
    counter = 0

    # Add class nodes (only those with instances or important hierarchy nodes)
    risk_event_cls = onto["RiskEvent"]
    if risk_event_cls is None:
        return {"nodes": [], "edges": [], "summary": "Ontology not initialized"}

    for cls in risk_event_cls.descendants():
        if cls.name == "RiskEvent":
            continue

        instances = list(cls.instances())
        instance_count = len(instances)

        # Calculate severity from instances
        max_severity = 0.0
        for inst in instances:
            sev_val = getattr(inst, "has_severity", None)
            if sev_val is not None:
                max_severity = max(max_severity, float(sev_val))

        # If no instances, use a base severity from class position
        if instance_count == 0:
            # Still show the class node but with low severity
            base_severity = 3.0
        else:
            base_severity = max_severity

        if base_severity < min_severity:
            continue

        counter += 1
        node_id = f"owl_{counter}"
        node_id_map[cls.name] = node_id

        # Determine node type based on OWL class hierarchy
        parent_names = [p.name for p in cls.is_a if hasattr(p, "name")]
        if "RiskEvent" in parent_names:
            node_type = "category"
        elif any(p in ("ProductLiability", "RegulatoryRisk", "ConsumerFraud", "FoodSafety")
                 for p in parent_names):
            node_type = "event"
        else:
            node_type = "risk_type"

        nodes.append({
            "id": node_id,
            "label": cls.name,
            "type": node_type,
            "severity": round(base_severity, 1),
            "severity_score": round(base_severity, 1),
            "instance_count": instance_count,
            "is_owl": True,
        })

    # Add Department nodes connected to risk classes
    dept_cls = onto["Department"]
    if dept_cls:
        for dept in dept_cls.instances():
            counter += 1
            node_id = f"owl_{counter}"
            node_id_map[dept.name] = node_id
            nodes.append({
                "id": node_id,
                "label": dept.name,
                "type": "department",
                "severity": 2.0,
                "severity_score": 2.0,
                "is_owl": True,
            })

    # Add Regulation nodes
    reg_cls = onto["Regulation"]
    if reg_cls:
        for reg in reg_cls.instances():
            counter += 1
            node_id = f"owl_{counter}"
            node_id_map[reg.name] = node_id
            nodes.append({
                "id": node_id,
                "label": reg.name,
                "type": "legal_clause",
                "severity": 4.0,
                "severity_score": 4.0,
                "is_owl": True,
            })

    # Add edges from class hierarchy (is_a relationships)
    edge_counter = 0
    for cls in risk_event_cls.descendants():
        if cls.name == "RiskEvent" or cls.name not in node_id_map:
            continue
        for parent in cls.is_a:
            if hasattr(parent, "name") and parent.name in node_id_map:
                edge_counter += 1
                edges.append({
                    "id": f"owl_e_{edge_counter}",
                    "source": node_id_map[parent.name],
                    "target": node_id_map[cls.name],
                    "relation": "is_a",
                    "label": "is_a",
                })

    # Add edges from instance relationships (affects_department, triggers_regulation)
    for cls in risk_event_cls.descendants():
        if cls.name not in node_id_map:
            continue
        cls_node_id = node_id_map[cls.name]

        # Department edges from mapping
        for dept_name in _CLASS_TO_DEPARTMENTS.get(cls.name, []):
            if dept_name in node_id_map:
                edge_counter += 1
                edges.append({
                    "id": f"owl_e_{edge_counter}",
                    "source": cls_node_id,
                    "target": node_id_map[dept_name],
                    "relation": "affects",
                    "label": "affects",
                })

        # Regulation edges from mapping
        for reg_name in _CLASS_TO_REGULATIONS.get(cls.name, []):
            if reg_name in node_id_map:
                edge_counter += 1
                edges.append({
                    "id": f"owl_e_{edge_counter}",
                    "source": cls_node_id,
                    "target": node_id_map[reg_name],
                    "relation": "triggers",
                    "label": "triggers",
                })

    # Build summary
    total_instances = len(list(risk_event_cls.instances()))
    class_count = len([c for c in risk_event_cls.descendants() if c.name != "RiskEvent"])
    summary = (
        f"OWL Ontology: {class_count} risk classes, "
        f"{total_instances} accumulated instances. "
        f"Inference rules active for severity boosting and cross-risk detection."
    )

    return {
        "nodes": nodes,
        "edges": edges,
        "summary": summary,
        "is_owl": True,
    }


def get_ontology_stats() -> dict:
    """Return summary stats about the current ontology state."""
    onto = _get_onto()
    risk_cls = onto["RiskEvent"]
    if risk_cls is None:
        return {"classes": 0, "instances": 0, "properties": 0}

    classes = list(risk_cls.descendants())
    total_instances = 0
    class_stats = {}
    for cls in classes:
        if cls.name == "RiskEvent":
            continue
        count = len(list(cls.instances()))
        if count > 0:
            class_stats[cls.name] = count
        total_instances += count

    return {
        "classes": len(classes) - 1,  # Exclude RiskEvent itself
        "instances": total_instances,
        "properties": len(list(onto.properties())),
        "class_breakdown": class_stats,
    }

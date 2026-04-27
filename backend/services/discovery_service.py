"""Web Discovery Engine — Google Custom Search API integration.

Searches the open web for brand-related risk signals (complaints, recalls,
lawsuits, side effects) using Google Custom Search JSON API.

Environment variables:
  GOOGLE_CSE_API_KEY — API key for Google Custom Search
  GOOGLE_CSE_CX     — Custom Search Engine ID (cx)
"""

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from urllib.parse import urlparse

import httpx

from backend.services.amazon_service import detect_risk_candidate

logger = logging.getLogger(__name__)

_SEARCH_SUFFIXES = [
    "complaint",
    "recall",
    "lawsuit",
    "side effects",
    "safety issue",
    "class action",
]

_GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"


def _build_queries(brand: str, product: str | None = None) -> list[str]:
    """Build 6 search queries combining brand/product with risk suffixes."""
    base = brand
    if product:
        base = f"{brand} {product}"
    return [f"{base} {suffix}" for suffix in _SEARCH_SUFFIXES]


def _extract_domain(url: str) -> str:
    """Extract clean domain from URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path
        return re.sub(r"^www\.", "", domain)
    except Exception:  # pylint: disable=broad-except
        return url


def _get_api_keys() -> tuple[str, str]:
    """Read API keys at call time (not module load) for testability."""
    return (
        os.getenv("GOOGLE_CSE_API_KEY", ""),
        os.getenv("GOOGLE_CSE_CX", ""),
    )


async def _search_google(
    query: str, api_key: str, cx: str, num: int = 5,
) -> list[dict]:
    """Call Google Custom Search JSON API and return items."""
    params = {
        "key": api_key,
        "cx": cx,
        "q": query,
        "num": min(num, 10),
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(_GOOGLE_CSE_URL, params=params)
        if resp.status_code == 429:
            logger.warning("Google CSE rate limit hit for query: %s", query)
            return []
        resp.raise_for_status()
        data = resp.json()
    return data.get("items", [])


def _load_category_discovery(industry: str) -> list[dict] | None:
    """Load category-specific discovery mock data from JSON file."""
    data_dir = Path(__file__).resolve().parents[1] / "data"
    files = {"hospital": "discovery_hospital.json", "finance": "discovery_finance.json"}
    filename = files.get(industry)
    if not filename:
        return None
    path = data_dir / filename
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return None


def _mock_results(industry: str = "ecommerce") -> list[dict]:
    """Return mock discovery results for demo — category-aware."""
    category_data = _load_category_discovery(industry)
    if category_data:
        return category_data
    # Default: food/CPG
    return [
        {
            "url": "https://www.classaction.org/news/plant-based-protein-mislabeling-class-action-2026",
            "title": "Plant-based protein mislabeling class action gains new plaintiffs",
            "snippet": (
                "A federal class action alleging that a major plant-based meat brand overstated "
                "protein content by up to 30% has added 1,200 new plaintiffs. Settlement estimates "
                "range from $2.4M to $3.5M based on FTC precedent."
            ),
            "risk_detected": True,
            "source_domain": "classaction.org",
            "similarity": 0.91,
        },
        {
            "url": "https://www.fda.gov/safety/recalls-market-withdrawals/plant-based-allergen-recall-2026",
            "title": "FDA recalls plant-based burger patties over undeclared soy allergen",
            "snippet": (
                "The FDA has issued a Class I recall for plant-based burger patties after lab tests "
                "confirmed undeclared soy protein. 23 adverse event reports filed, including 3 "
                "anaphylactic reactions requiring hospitalization."
            ),
            "risk_detected": True,
            "source_domain": "fda.gov",
            "similarity": 0.88,
        },
        {
            "url": "https://www.reuters.com/business/retail-consumer/plant-based-meat-ecoli-investigation-2026",
            "title": "E. coli investigation targets plant-based meat processing facility",
            "snippet": (
                "CDC and FDA are jointly investigating an E. coli outbreak linked to a plant-based "
                "meat processing plant in Missouri. 14 confirmed cases across 5 states."
            ),
            "risk_detected": True,
            "source_domain": "reuters.com",
            "similarity": 0.84,
        },
        {
            "url": "https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-food-labeling-enforcement",
            "title": "FTC increases enforcement on food nutrition label accuracy",
            "snippet": (
                "The FTC announced expanded enforcement actions targeting food brands whose nutrition "
                "labels deviate more than 20% from actual tested values, citing consumer protection concerns."
            ),
            "risk_detected": True,
            "source_domain": "ftc.gov",
            "similarity": 0.79,
        },
        {
            "url": "https://www.consumeraffairs.com/food/plant-based-patty-food-poisoning-reports",
            "title": "Consumer complaints: plant-based patties linked to food poisoning",
            "snippet": (
                "ConsumerAffairs has received 89 complaints in the past 60 days from consumers "
                "reporting nausea, vomiting, and diarrhea after consuming plant-based burger patties "
                "from multiple brands."
            ),
            "risk_detected": True,
            "source_domain": "consumeraffairs.com",
            "similarity": 0.76,
        },
        {
            "url": "https://www.bbb.org/us/complaints/food-supplement-false-claims-2026",
            "title": "BBB complaints surge for food supplements with unverified health claims",
            "snippet": (
                "The Better Business Bureau reports a 340% increase in complaints about food and "
                "supplement brands making health claims not supported by clinical evidence."
            ),
            "risk_detected": True,
            "source_domain": "bbb.org",
            "similarity": 0.52,
        },
        {
            "url": "https://www.reddit.com/r/PlantBased/comments/xyz/grey_discoloration_in_patties/",
            "title": "Grey discoloration inside plant-based patties — safety concern?",
            "snippet": (
                "Multiple users on r/PlantBased reporting grey or green discoloration inside "
                "sealed, non-expired patties. Some report illness after consumption."
            ),
            "risk_detected": True,
            "source_domain": "reddit.com",
            "similarity": 0.72,
        },
    ]


async def search_brand_risks(  # pylint: disable=too-many-locals
    brand_name: str, product_name: str | None = None, industry: str = "ecommerce",
) -> dict:
    """Search the web for brand-related risk signals.

    Returns:
        dict with keys: results, total_scanned, risks_found
    """
    api_key, cx = _get_api_keys()

    # Fallback to mock if API keys are not configured
    if not api_key or not cx:
        logger.info("Google CSE keys not set — returning mock discovery results")
        mock = _mock_results(industry)
        return {
            "results": mock,
            "total_scanned": len(mock),
            "risks_found": len(mock),
        }

    queries = _build_queries(brand_name, product_name)
    all_items: list[dict] = []
    seen_urls: set[str] = set()

    # Run all queries concurrently
    tasks = [_search_google(q, api_key, cx, num=5) for q in queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for query, result in zip(queries, results):
        if isinstance(result, Exception):
            logger.warning("Google CSE query failed for '%s': %s", query, result)
            continue
        for item in result:
            url = item.get("link", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)
            all_items.append({
                "url": url,
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "source_domain": _extract_domain(url),
            })

    # Filter by risk candidate detection
    risk_results = []
    for item in all_items:
        text = f"{item['title']} {item['snippet']}"
        if detect_risk_candidate(text):
            item["risk_detected"] = True
            risk_results.append(item)

    return {
        "results": risk_results,
        "total_scanned": len(all_items),
        "risks_found": len(risk_results),
    }

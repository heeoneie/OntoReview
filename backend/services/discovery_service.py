"""Web Discovery Engine — Google Custom Search API integration.

Searches the open web for brand-related risk signals (complaints, recalls,
lawsuits, side effects) using Google Custom Search JSON API.

Environment variables:
  GOOGLE_CSE_API_KEY — API key for Google Custom Search
  GOOGLE_CSE_CX     — Custom Search Engine ID (cx)
"""

import asyncio
import logging
import os
import re
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


def _mock_results() -> list[dict]:
    """Return mock discovery results for demo when API keys are not set."""
    return [
        {
            "url": (
                "https://www.consumeraffairs.com"
                "/cosmetics/k-beauty-snail-serum.html"
            ),
            "title": (
                "K-Beauty Snail Serum complaints"
                " — skin rash and allergic reactions reported"
            ),
            "snippet": (
                "Multiple consumers reported severe rash and"
                " allergic reactions after using the snail mucin"
                " serum. Several cases required hospital visits."
            ),
            "risk_detected": True,
            "source_domain": "consumeraffairs.com",
        },
        {
            "url": (
                "https://www.fda.gov/safety"
                "/recalls-market-withdrawals"
                "/korean-cosmetics-recall-2026"
            ),
            "title": (
                "FDA issues recall for Korean cosmetics"
                " containing banned ingredients"
            ),
            "snippet": (
                "The FDA has initiated a voluntary recall of"
                " three K-Beauty products found to contain"
                " hydroquinone above permitted levels,"
                " a banned substance without prescription."
            ),
            "risk_detected": True,
            "source_domain": "fda.gov",
        },
        {
            "url": (
                "https://www.reuters.com/business"
                "/retail-consumer/samsung-class-action"
                "-battery-defect-2026-02-15/"
            ),
            "title": (
                "Samsung faces class action lawsuit"
                " over battery defect in Galaxy devices"
            ),
            "snippet": (
                "A class action lawsuit has been filed"
                " against Samsung Electronics alleging a"
                " battery defect that caused overheating"
                " and injury to multiple consumers."
            ),
            "risk_detected": True,
            "source_domain": "reuters.com",
        },
        {
            "url": (
                "https://www.reddit.com/r/SkincareAddiction"
                "/comments/abc123"
                "/warning_korean_toner_chemical_burn/"
            ),
            "title": (
                "WARNING: Korean toner caused"
                " chemical burn on my face"
            ),
            "snippet": (
                "I used this K-Beauty toner and got a chemical"
                " burn on my cheek. My dermatologist said the"
                " pH level is dangerously low."
            ),
            "risk_detected": True,
            "source_domain": "reddit.com",
        },
        {
            "url": (
                "https://www.bbb.org/us/complaints"
                "/korean-food-products-expired"
            ),
            "title": (
                "BBB complaints: Korean food products"
                " arriving expired"
            ),
            "snippet": (
                "The Better Business Bureau has received 47"
                " complaints about Korean food products arriving"
                " expired or with contaminated packaging."
            ),
            "risk_detected": True,
            "source_domain": "bbb.org",
        },
        {
            "url": (
                "https://www.classaction.org/news"
                "/nike-air-max-sole-separation-lawsuit"
            ),
            "title": (
                "Nike Air Max sole separation"
                " lawsuit moves forward"
            ),
            "snippet": (
                "A federal judge has allowed a class action"
                " lawsuit against Nike to proceed, alleging"
                " defective sole construction that caused"
                " injury to runners."
            ),
            "risk_detected": True,
            "source_domain": "classaction.org",
        },
        {
            "url": (
                "https://www.cpsc.gov/Recalls/2026"
                "/Korean-Baby-Snack-Recall-Choking-Hazard"
            ),
            "title": (
                "CPSC recalls Korean baby snack"
                " over choking hazard"
            ),
            "snippet": (
                "The U.S. Consumer Product Safety Commission"
                " has recalled a Korean baby rice snack product"
                " due to choking hazard from hard pieces."
            ),
            "risk_detected": True,
            "source_domain": "cpsc.gov",
        },
        {
            "url": (
                "https://www.ftc.gov/news-events/news"
                "/press-releases/2026/01"
                "/ftc-counterfeit-k-beauty-sellers"
            ),
            "title": (
                "FTC takes action against counterfeit"
                " K-Beauty sellers on Amazon"
            ),
            "snippet": (
                "The Federal Trade Commission has filed"
                " complaints against multiple sellers for"
                " distributing counterfeit Korean cosmetics"
                " with misleading ingredient labels."
            ),
            "risk_detected": True,
            "source_domain": "ftc.gov",
        },
        {
            "url": (
                "https://www.coca-colacompany.com"
                "/press-releases/product-quality-update"
            ),
            "title": (
                "Coca-Cola issues quality update"
                " after contamination reports"
            ),
            "snippet": (
                "Coca-Cola has issued a voluntary quality"
                " update after reports of contaminated bottles"
                " in three states, leading to stomach illness."
            ),
            "risk_detected": True,
            "source_domain": "coca-colacompany.com",
        },
    ]


async def search_brand_risks(
    brand_name: str, product_name: str | None = None,
) -> dict:
    """Search the web for brand-related risk signals.

    Returns:
        dict with keys: results, total_scanned, risks_found
    """
    api_key, cx = _get_api_keys()

    # Fallback to mock if API keys are not configured
    if not api_key or not cx:
        logger.info("Google CSE keys not set — returning mock discovery results")
        mock = _mock_results()
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

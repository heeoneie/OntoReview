"""Smoke tests — verify 3 category Run Analysis returns 200.

Run: pytest tests/test_category_smoke.py -v
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

CATEGORIES = ["ecommerce", "hospital", "finance"]


@pytest.mark.parametrize("industry", CATEGORIES)
def test_demo_endpoint_returns_200(industry):
    """POST /api/data/demo?industry={industry} should return 200."""
    resp = client.post(f"/api/data/demo?industry={industry}", timeout=120)
    assert resp.status_code == 200, f"{industry} failed: {resp.text[:200]}"
    data = resp.json()
    assert "scan_id" in data, f"{industry} response missing scan_id"


@pytest.mark.parametrize("industry", CATEGORIES)
def test_discovery_endpoint_returns_200(industry):
    """POST /api/discovery/search should return 200 for each category."""
    brands = {"ecommerce": "Beyond Meat", "hospital": "MedStar Health", "finance": "PayTrust"}
    resp = client.post(
        "/api/discovery/search",
        json={"brand": brands[industry], "industry": industry},
    )
    assert resp.status_code == 200, f"{industry} discovery failed: {resp.text[:200]}"
    data = resp.json()
    assert "results" in data


@pytest.mark.parametrize("industry", CATEGORIES)
def test_no_cross_category_contamination(industry):
    """Risk timeline should not contain keywords from other categories."""
    # Run demo first
    client.post(f"/api/data/demo?industry={industry}", timeout=120)

    # Check timeline
    resp = client.get("/api/kpi/timeline?limit=50")
    assert resp.status_code == 200

    forbidden = {
        "ecommerce": ["knee surgery", "hip implant", "HIPAA", "overdraft", "trading halt"],
        "hospital": ["protein", "plant-based", "patties", "allergen", "overdraft", "trading"],
        "finance": ["protein", "plant-based", "knee surgery", "hip implant", "malpractice"],
    }

    timeline_text = " ".join(item.get("name", "") for item in resp.json()).lower()
    for keyword in forbidden[industry]:
        assert keyword.lower() not in timeline_text, (
            f"{industry} timeline contains forbidden keyword '{keyword}'"
        )

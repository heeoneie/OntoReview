"""Discovery router — Web-wide brand risk scanning."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.discovery_service import search_brand_risks

logger = logging.getLogger(__name__)
router = APIRouter()


class DiscoveryRequest(BaseModel):
    brand: str
    product: Optional[str] = None
    industry: str = "ecommerce"


@router.post("/search")
async def search_web_risks(request: DiscoveryRequest):
    """Search the open web for brand-related risk signals."""
    if not request.brand.strip():
        raise HTTPException(400, "Brand name is required.")
    try:
        return await search_brand_risks(
            request.brand.strip(),
            request.product.strip() if request.product else None,
            industry=request.industry,
        )
    except Exception:
        logger.exception("Web discovery search failed")
        raise HTTPException(500, "Web discovery search failed.") from None

import asyncio
import logging
import os
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 프로젝트 루트를 path에 추가하여 core 패키지 import 가능하게
PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database.database import engine  # pylint: disable=wrong-import-position
from backend.database.models import Base  # pylint: disable=wrong-import-position
from backend.routers import (  # pylint: disable=wrong-import-position
    analysis,
    audit,
    data,
    discovery,
    evaluate,
    kpi,
    reply,
    risk,
    youtube,
)
from backend.services.legal_rag_service import (  # pylint: disable=wrong-import-position
    warm_embedding_cache,
)
from backend.services.ontology_engine import (  # pylint: disable=wrong-import-position
    init_ontology,
)

logger = logging.getLogger("ontoreview.startup")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle for the FastAPI application."""
    # ── Startup ──
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")

    # Migrate: add owl_class & reasoning_path columns if missing
    from sqlalchemy import inspect as sa_inspect, text  # pylint: disable=import-outside-toplevel
    insp = sa_inspect(engine)
    existing_cols = {c["name"] for c in insp.get_columns("nodes")}
    with engine.begin() as conn:
        if "owl_class" not in existing_cols:
            conn.execute(text("ALTER TABLE nodes ADD COLUMN owl_class VARCHAR(128)"))
            logger.info("Migrated: added nodes.owl_class column")
        if "reasoning_path" not in existing_cols:
            conn.execute(text("ALTER TABLE nodes ADD COLUMN reasoning_path TEXT"))
            logger.info("Migrated: added nodes.reasoning_path column")

    # Initialize OWL ontology schema (fail-open)
    try:
        init_ontology()
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("OWL ontology init skipped: %s", exc)

    # Pre-compute legal case embeddings (fail-open with timeout)
    try:
        await asyncio.wait_for(
            asyncio.to_thread(warm_embedding_cache),
            timeout=60,
        )
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Embedding cache warm-up skipped: %s", exc)

    yield
    # ── Shutdown ── (nothing to clean up)


app = FastAPI(
    title="Review Analysis Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)


def _get_allowed_origins() -> List[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "")
    if not raw_origins:
        return ["http://localhost:5173", "http://localhost:3000"]
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(reply.router, prefix="/api/reply", tags=["reply"])
app.include_router(risk.router, prefix="/api/risk", tags=["risk"])
app.include_router(evaluate.router, prefix="/api/evaluate", tags=["evaluate"])
app.include_router(youtube.router, prefix="/api/youtube", tags=["youtube"])
app.include_router(kpi.router, prefix="/api/kpi", tags=["kpi"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}

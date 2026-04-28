# CLAUDE.md — OntoReview Production Development Guide

This file provides **strict guidance to Claude Code** when working on this repository.  
Read this file before generating or modifying any code.

---

# 🎯 Product Identity

**OntoReview — Litigation Prevention OS for K-Brands entering the US market**

Positioning:

> "Palantir for Reputation & Legal Risk"

We help **K-Beauty / K-Food companies detect legal risk in customer reviews before lawsuits happen.**

The system identifies:

- Product Liability signals
- Regulatory risks
- Class Action indicators

Then estimates **potential financial exposure using US legal precedent.**

---

# ⏱ Production Context

OntoReview is in **production mode**.

The system is shipped to paying customers (Free, Team, Legal, Enterprise tiers).
Customers depend on it for legal-risk monitoring with regulatory implications.

Therefore:

**Correctness > Speed.** **Auditability > Cleverness.** **Boring > Novel.**

We optimize for: long-term maintainability, customer trust, defensible behavior under
audit, and operational reliability. There is no demo deadline driving decisions.

---

# 🚨 PRODUCTION MODE RULE (CRITICAL)

Every change must be safe to deploy to live customers.

Before merging, the change must satisfy:

1. **Correctness** — Risk classification, exposure math, and audit events behave deterministically and are unit-tested.
2. **Auditability** — Any state-changing action emits an `audit_events` row. No silent fallbacks for legal-risk findings.
3. **Reliability** — Errors degrade gracefully (LLM fallback chain, retries with backoff, idempotent scans).
4. **Security & Privacy** — Customer review data is isolated per tenant. Secrets via env, never committed. PII handling documented.
5. **UX polish** — Production-grade: empty states, loading states, error boundaries, accessibility.

If a feature improves measurable customer outcomes (risk caught, exposure
quantified, audit trail completeness, time-to-insight), it ships. Otherwise it
needs a written justification before being built.

---

# 🧠 Core Product Concept

OntoReview converts **customer reviews into legal intelligence.**

Pipeline:

Amazon Reviews
↓
Risk Detection (LLM)
↓
Legal Category Classification
↓
Precedent Matching (Micro-RAG)
↓
Estimated Financial Exposure
↓
Audit Log


Final output example:


⚠️ Product Liability Risk Detected

Matched Precedent:
Johnson & Johnson Talc Case

Estimated Legal Exposure:
$5,400,000


---

# ⚠️ ENGINEERING CONSTRAINTS

## 1. Add complexity only when justified

Adopt new infrastructure only when there's a measurable need (load, scale,
reliability, compliance). Each addition must come with: an owner, a runbook,
and a decommission criterion.

Currently in scope (use freely when justified):

- Vector databases (Chroma, pgvector, Qdrant) for precedent matching at > 1K cases
- Background workers / queues (Celery + Redis or similar) for long-running scans
- Container orchestration (Docker Compose for staging; managed K8s/ECS for prod)
- Tenant-aware authentication (OAuth, SSO via Auth0/WorkOS for Enterprise tier)
- Observability stack (structured logs, metrics, traces — OpenTelemetry-compatible)

> **Note:** `chromadb` exists in `requirements.txt` and `core/experiments/rag_system.py`.
> Promote `core/experiments/rag_system.py` to a first-class module under `core/rag/`
> with tests before relying on it in the live precedent-matching path. Do not
> import from `core/experiments/` in production code.

---

## 2. Default Architecture

Stack of record (deviate only with a documented ADR):

Frontend
- React + Vite
- Tailwind + design tokens (`src/styles/tokens.css`, `src/styles/marketing.css`)
- React Router v7

Backend
- FastAPI (Python 3.11+)
- Pydantic v2 for I/O contracts

Database
- PostgreSQL for production (per-tenant schema or row-level isolation)
- SQLite acceptable for local dev and CI only

ORM / Migrations
- SQLAlchemy 2.x
- Alembic for schema migrations (every schema change goes through a migration)

LLM (provider-agnostic abstraction in `core/utils/openai_client.py`)
- Primary: OpenAI GPT-4o-mini (default for production, `LLM_PROVIDER=openai`)
- Fallback: Gemini 2.0 Flash (automatic on OpenAI failure, with structured retry)
- Embeddings: `text-embedding-3-small` (cached per legal case revision)
- Larger models (GPT-4 family, Claude) allowed for high-stakes flows
  (e.g., final exposure justification) when the cost/quality tradeoff is documented.

Infrastructure
- Render for the current production deployment (`render.yaml`)
- Secrets via environment variables; never commit to git
- CI runs `lint`, `typecheck` where applicable, `test`, `build`

---

## 3. Data & Knowledge Base

The legal precedent dataset is curated and versioned.

Primary location:

backend/data/legal_cases.json

There is no hard cap on dataset size, but every case must be:
- Sourced from a publicly available US legal precedent
- Reviewed by a human before merge (PR template: `case_id`, source URL, jurisdiction)
- Embedded at startup or via offline batch into the configured vector store

Larger ingestion pipelines (CSV bulk loads, scraping, third-party feeds) are
allowed but must run as separate background jobs with audit-event emission and
must not block the request path.

---

# ⚙️ System Architecture


Frontend (React)
↓
FastAPI Backend
↓
Risk Engine
↓
Micro-RAG (JSON)
↓
SQLite


---

# 🧠 Legal Risk Engine

Every analyzed review must generate:


risk_category
severity_score
confidence_score
estimated_loss_usd
matched_case


Example:


Review:
"This cream burned my skin"

Output:
risk_category: Product Liability
severity_score: 8
confidence_score: 0.82
matched_case: Cosmetic Chemical Burn Case
estimated_loss_usd: 2300000


---

## Risk Categories

Allowed categories:


Product Liability
Regulatory Risk
False Advertising
Consumer Safety
Class Action Risk


---

## Risk Score Formula


overall_risk_score =
Σ(severity_score × confidence_score)


---

## Financial Exposure


total_legal_exposure_usd =
Σ(estimated_loss_usd)


This value must be visible on the **dashboard KPI**.

---

# 📚 Micro-RAG (Legal Precedent Matching)

We use a **small JSON legal knowledge base.**

Location:


backend/data/legal_cases.json


Example entry:

```json
{
  "case_id": "PL-2023-TALC",
  "case_title": "Johnson & Johnson Talc Case",
  "risk_category": "Product Liability",
  "trigger_keywords": ["cancer", "talc", "toxic"],
  "historical_settlement": {"min": 1500000, "max": 3000000, "avg": 2250000}
}
```

Matching Strategy

Production techniques (in order of preference):
- Vector store (Chroma or pgvector) with precomputed embeddings, refreshed on
  case-revision deploy. This is the default path for > 200 cases.
- In-memory NumPy cosine fallback for local dev and CI environments.
- TF-IDF + keyword + category matching used as a deterministic secondary signal,
  blended into the final score for explainability.

External RAG services (Pinecone, Weaviate, etc.) are permitted but require an
ADR justifying the dependency, and per-tenant data isolation must be verified.

Every match must record `cosine_score`, `severity_weight`, and the chosen
`matched_case_id` to the audit trail so the score can be reproduced later.

🛡 The Shield — Audit Log

The system must prove Duty of Care.

Create an append-only SQLite table:

audit_events

Fields:

- id
- timestamp (Indexed)
- scan_id (Correlation ID - UUID, Indexed)
- event_type (Enum: SCAN_STARTED, REVIEW_CLASSIFIED, PRECEDENT_MATCHED, RISK_FLAGGED, SCAN_COMPLETED)
- review_id (nullable)
- risk_category (nullable)
- details (JSON text)
- created_by (default: "system")

Example:

timestamp: 2026-03-09T10:03:11
scan_id: a1b2c3d4-5678-90ef...
event_type: RISK_FLAGGED
risk_category: Product Liability
details: {"severity": 9, "exposure": 2300000}

🎨 Frontend UX Structure

The UI should contain only these pages.

1. Risk Intelligence Dashboard

Displays:

total_legal_exposure_usd

critical_risks_count

recent detected risks

2. Review Risk Analysis

Displays:

Review text

Risk category

Severity score

Matched precedent

Estimated legal exposure

3. Legal Precedent Explorer

Displays:

Case name

Settlement amount

Risk category

Matching explanation

4. Audit Log

Displays:

timestamp

detected risk

system action

5. Duty of Care PDF Export

Displays:

- Hidden Print-Friendly Light Theme container
- Executive Summary & Total Exposure
- System Audit Trail
- "CONFIDENTIAL" footer watermark

🤖 LLM Usage Rules

Models are configured via `core/utils/openai_client.py`. Pick by job, not by habit.

- **Primary (production):** OpenAI `gpt-4o-mini` — set `LLM_PROVIDER=openai`.
- **Fallback:** `gemini-2.0-flash` (automatic on OpenAI failure, with structured
  retry). Failover transitions must emit an audit event.
- **Local dev:** `LLM_PROVIDER=google` flips the order — Gemini primary with
  429-aware backoff, OpenAI as fallback.
- **High-stakes flows:** GPT-4 / Claude are permitted when the decision is
  consumer-visible (final exposure dollar number, executive PDF output) and the
  cost/quality tradeoff is documented in a code comment or ADR.
- **Embeddings:** `text-embedding-3-small` is the default; cache per legal-case
  revision. Larger embedding models (`text-embedding-3-large`, etc.) require
  benchmarking evidence before adoption.

Token budgets are tuned per endpoint, not globally. Default `max_tokens` is set
in the client; override per call only when the use case justifies it.

Cost & latency:
- Track p50/p95 latency and per-tenant token cost.
- Budget alerts wired to operational dashboards.

---

🎬 Production User Flow

The product must support this primary flow end-to-end without manual operator
intervention:

1. User signs in (per-tenant auth) and selects a brand.
2. System ingests reviews from the configured connector (Amazon, Trustpilot,
   Bazaarvoice, or CSV upload). Ingestion is incremental and idempotent.
3. Risk engine classifies each review against the OWL ontology.
4. Precedent matcher returns top-k cases with `cosine_score` and severity.
5. Dashboard shows: Total Legal Exposure (KPI), severity timeline, per-finding
   detail with matched precedent and confidence interval.
6. Risk Response Playbook produces mitigation steps per matched precedent.
7. Audit log records every classification, match, alert, and export.
8. Optional: scheduled scans, Slack/Teams alerts, PDF quarterly reports.

Each step has SLOs (latency, error rate, audit completeness) tracked in the
operational dashboard.
💻 Development Commands
Setup
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

Create .env file:

OPENAI_API_KEY=your_key_here
Run Backend
uvicorn backend.main:app --reload
Run Frontend
cd frontend
npm run dev
🌿 Git Branch Rules

Never commit directly to main.

Create branches from main.

Branch Naming
Prefix	Usage
feat/	new feature
fix/	bug fix
refactor/	code refactor
test/	tests only
docs/	documentation
chore/	dependency or config

Example:

feat/legal-risk-engine
fix/nan-serialization
Commit Messages

Use Conventional Commits

feat: legal risk engine 구현
fix: audit log timestamp 버그 수정
refactor: risk scoring 구조 개선
🧠 Development Philosophy

This is NOT a generic review analytics tool.

This product exists to answer one question:

"How much money could this lawsuit cost us?"

Every feature must highlight:

Legal Exposure ($)

Compliance (Audit Trail)

If a feature does not support those goals, do not build it.
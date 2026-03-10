# CLAUDE.md — OntoReview Hackathon Development Guide

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

# ⏱ Hackathon Context

This product is being built for:

- **Amazon Hackathon (March 16)**
- **YC Pitch (March 26)**

We have **less than 13 days**.

Therefore:

**Speed > Perfection**

This is a **hackathon prototype**, not a production system.

---

# 🚨 HACKATHON MODE RULE (CRITICAL)

This project exists for a **3-minute live demo**.

If a feature does NOT improve the demo flow, **do NOT build it.**

Priority order:

1. Demo Flow Stability  
2. Legal Risk Detection  
3. Financial Exposure ($)  
4. Audit Log (Duty of Care)  
5. UI Polish  

Anything outside this list should be ignored.

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

# ⚠️ STRICT ENGINEERING CONSTRAINTS

## 1. NO OVER-ENGINEERING

Do NOT build:

- Vector databases (Pinecone, Chroma, Qdrant) for production paths
- Microservice architectures
- Complex authentication systems
- Large-scale crawlers
- Distributed queues
- Kubernetes / Docker orchestration

> **Note:** `chromadb` exists in requirements.txt and `core/experiments/rag_system.py`
> as an experimental/research path only. It is NOT used in the demo pipeline.
> Confirmed not used in March 16 demo. Remove chromadb and core/experiments/ by March 20.

This is a **hackathon demo system**.

---

## 2. Keep Architecture Simple

Allowed stack:

Frontend  
- React
- Tailwind (dark mode)

Backend  
- FastAPI

Database  
- SQLite

ORM  
- SQLAlchemy

LLM (default: gpt-4o-mini)
- GPT-4o-mini (primary, default)
- Gemini 2.0 Flash (fallback when OpenAI fails)
- Amazon Nova via Bedrock (optional, for AWS demos only)

---

## 3. No Large Data Pipelines

Do NOT rely on:

- Kaggle datasets
- Large CSV ingestion
- Big data infrastructure

Use a **small curated dataset instead.**

Data location:


backend/data/legal_cases.json


Maximum size: **< 200 cases**

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

Allowed techniques:
- In-memory Embedding Cache (computed at FastAPI startup)
- Cosine similarity via NumPy
- TF-IDF Fallback
- keyword matching
- category matching

NOT allowed:
- External Vector databases (Pinecone, Chroma, Qdrant)
- external RAG services

Dataset size is intentionally small.

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

Default model: `gpt-4o-mini`
Fallback model: `gemini-2.0-flash` (automatic on OpenAI failure)

Allowed exceptions:
- Amazon Nova via Bedrock (AWS demo environments only)
- `text-embedding-3-small` for legal case embedding (cached at startup)

Do NOT use:
- GPT-4 / GPT-4 Turbo (too expensive for hackathon)
- Large embedding models (ada-002 etc.)

Maximum tokens per request: 500
🎬 Required Demo Scenario

The entire system must support this 3-minute demo flow.

Step 1

User inputs Amazon ASIN

Step 2

System ingests reviews (mock data allowed)

Step 3

Risk engine analyzes reviews

Step 4

Micro-RAG matches US legal precedent

Step 5

Dashboard displays:

Risk Category
Severity
Estimated Legal Exposure
Step 6

System generates:

Risk Mitigation Playbook
Step 7

Audit log records the event

Final Demo Screen

The demo must end with:

⚠️ Estimated Legal Exposure

$5,400,000
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
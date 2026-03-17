# OntoReview

**AI-powered litigation prevention OS that converts customer reviews into legal intelligence.**

Powered by **Amazon Nova 2 Lite** on AWS Bedrock + OWL Ontology Reasoning.

> *"Palantir for Reputation & Legal Risk"*

**Live Demo:** https://onto-review.vercel.app  
**Hackathon:** Amazon Nova AI Hackathon 2026 · Category: Agentic AI  
**Hashtag:** #AmazonNova

---

## The Problem

When K-Beauty and K-Food brands enter the US market, a single review like *"this cream burned my skin"* can trigger a multi-million dollar product liability lawsuit. Most SMBs discover this risk only after receiving a legal notice — by then, it's too late.

**OntoReview detects legal risks hidden in product reviews before they become lawsuits.**

---

## How It Works

```
Amazon Reviews (ASIN input)
        ↓
  Risk Classification (Amazon Nova 2 Lite)
        ↓
  OWL Ontology Reasoning (owlready2)
        ↓
  Legal Precedent Matching (Micro-RAG)
        ↓
  Financial Exposure Estimation
        ↓
  Risk Mitigation Playbook
        ↓
  Audit Trail (Duty of Care)
```

Every analyzed review generates:

| Field | Example |
|-------|---------|
| Risk Category | Product Liability |
| Severity Score | 8 / 10 |
| Confidence | 0.82 |
| Matched Precedent | Johnson & Johnson Talc Case |
| Estimated Legal Exposure | $2,300,000 |

---

## Amazon Nova Integration

Amazon Nova 2 Lite (`amazon.nova-2-lite-v1:0`) serves as the **primary reasoning engine** through AWS Bedrock. Nova powers every intelligent component:

- **Risk Classification** — analyzes review text, assigns legal risk categories with severity scores (1–10) and confidence levels
- **Legal Exposure Estimation** — cross-references detected risks with matched legal precedents to estimate financial damages
- **Playbook Generation** — generates context-aware mitigation strategies per risk category and severity
- **Compliance Analysis** — evaluates risks against multi-jurisdiction regulations (US FDA, EU Consumer Protection, KR Fair Trade)
- **Agent Response Simulation** — powers configurable AI agents with different autonomy levels for automated risk response

### LLM Provider Architecture

The system uses a clean provider abstraction layer. Switching between Nova, OpenAI, and Gemini requires only one environment variable:

```bash
LLM_PROVIDER=bedrock   # Amazon Nova (hackathon / production)
LLM_PROVIDER=openai    # OpenAI GPT-4o-mini (fallback)
LLM_PROVIDER=google    # Gemini 2.0 Flash (local development)
```

Implementation: [`core/utils/openai_client.py`](core/utils/openai_client.py)

---

## Features (6 Modules)

### Product Modules (Fully Functional)

**1. Risk Intelligence Dashboard**  
Real-time dashboard displaying total legal exposure, critical risk count, severity distribution, and risk category breakdown.

**2. Risk Response Playbook**  
AI-generated mitigation strategies tailored to each detected risk. Includes priority actions, timeline, and escalation paths.

**3. Trust & Safety Audit**  
Append-only audit log recording every scan, classification, and risk flag. Exportable as PDF for legal compliance (Duty of Care).

### Narrative Modules (Expandable)

**4. Domain Ontology Studio**  
Custom OWL ontology rule editor. Users can define industry-specific risk classification rules that feed into the ontology engine.

**5. Global Compliance Tracker**  
Multi-jurisdiction regulation checking across US, EU, and KR. Maps detected risks to relevant regulatory frameworks.

**6. Agent Communication Setup**  
Configurable AI agent autonomy levels (1–5) for automated risk response. Includes simulation mode for testing agent behavior.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Amazon Nova 2 Lite via AWS Bedrock |
| Ontology | OWL 2 (owlready2) |
| Backend | Python, FastAPI |
| Frontend | React, Tailwind CSS |
| Database | SQLite, SQLAlchemy |
| Legal RAG | In-memory embedding cache + cosine similarity + TF-IDF fallback |
| Deployment | Vercel (frontend), Render (backend) |

---

## Project Structure

```
OntoReview/
├── backend/
│   ├── main.py                  # FastAPI application + lifespan
│   ├── routers/                 # API route handlers
│   │   ├── risk.py              # Risk analysis endpoints
│   │   ├── agent.py             # Agent communication setup
│   │   ├── compliance.py        # Global compliance tracker
│   │   ├── studio.py            # Domain ontology studio
│   │   ├── audit.py             # Trust & safety audit
│   │   ├── discovery.py         # Web discovery engine
│   │   └── ...
│   ├── services/                # Business logic
│   │   ├── risk_service.py      # Core risk analysis (Nova-powered)
│   │   ├── ontology_engine.py   # OWL ontology reasoning
│   │   ├── legal_rag_service.py # Legal precedent matching (Micro-RAG)
│   │   ├── playbook_service.py  # Risk response playbook generation
│   │   └── ...
│   ├── data/
│   │   └── legal_cases.json     # 30 curated US legal precedents
│   └── database/
│       ├── database.py          # SQLite connection
│       └── models.py            # SQLAlchemy models (audit trail)
├── core/
│   ├── config.py                # Environment & LLM configuration
│   └── utils/
│       └── openai_client.py     # Multi-provider LLM abstraction (Nova/OpenAI/Gemini)
├── frontend/
│   └── src/
│       ├── components/          # React UI components
│       │   ├── RiskIntelligence.jsx
│       │   ├── RiskPlaybook.jsx
│       │   ├── AuditTimeline.jsx
│       │   ├── OntologyStudio.jsx
│       │   ├── ComplianceTracker.jsx
│       │   ├── AgentSetup.jsx
│       │   └── ...
│       └── api/client.js        # API client
├── infra/                       # Deployment configs (Nginx, systemd)
├── tests/                       # Unit tests
├── CLAUDE.md                    # Development guide
└── requirements.txt
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- AWS Account with Bedrock access (Amazon Nova 2 Lite enabled in us-east-1)

### Setup

```bash
# Clone
git clone https://github.com/heeoneie/OntoReview.git
cd OntoReview

# Backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# AWS Bedrock (Amazon Nova) — Required
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=us-east-1
LLM_PROVIDER=bedrock

# Fallback LLMs (Optional)
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
```

### Run

```bash
# Backend (terminal 1)
uvicorn backend.main:app --reload

# Frontend (terminal 2)
cd frontend
npm run dev
```

Open http://localhost:5173

---

## Demo Scenario

The system supports this 3-minute demo flow:

1. **Input** — Enter an Amazon ASIN or use demo data
2. **Ingest** — System loads product reviews
3. **Analyze** — Amazon Nova classifies legal risks with severity scores
4. **Match** — Micro-RAG finds relevant US legal precedents
5. **Dashboard** — Risk Intelligence displays total legal exposure (e.g., $5.4M)
6. **Playbook** — AI generates risk mitigation strategies
7. **Audit** — Immutable audit trail records all events for compliance

---

## Risk Scoring

```
RiskScore = Σ(severity_i × confidence_i)

TotalLegalExposure = Σ(estimated_loss_usd_i)
```

Where `severity_i` is the Nova-generated risk severity (1–10), `confidence_i` is classification confidence (0–1), and `estimated_loss_usd_i` is derived from matched US legal precedent settlement data.

### Risk Categories

- Product Liability
- Regulatory Risk
- False Advertising
- Consumer Safety
- Class Action Risk

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/risk/demo` | Run risk analysis on demo reviews |
| POST | `/api/risk/ontology` | OWL ontology-based risk classification |
| POST | `/api/risk/playbook/generate` | Generate risk mitigation playbook |
| GET | `/api/risk/ontology/graph` | Get ontology knowledge graph |
| POST | `/api/compliance/check` | Multi-jurisdiction compliance check |
| GET | `/api/compliance/regulations` | List available regulations |
| POST | `/api/agent/simulate` | Simulate AI agent response |
| GET | `/api/audit/events` | Retrieve audit trail |
| POST | `/api/discovery/search` | Web discovery engine search |
| GET | `/api/kpi/summary` | Dashboard KPI summary |
| GET | `/api/health` | Health check |

---

## Deployment

**Frontend** — Vercel  
**Backend** — Render

```yaml
# render.yaml
services:
  - type: web
    name: ontoreview-api
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: LLM_PROVIDER
        value: bedrock
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
      - key: AWS_DEFAULT_REGION
        value: us-east-1
```

---

## License

MIT License
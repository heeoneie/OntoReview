import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, FileText, Video, AlertOctagon, CheckCircle2, Check, X, Minus,
  Radar, ShieldCheck, ScrollText, GitBranch, Globe2, Bot, ArrowRight,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import markSvg from '../assets/mark.svg';

/* ── FAQ data ── */
const FAQS = [
  {
    q: 'Is our review data used to train models?',
    a: 'No. Your data is processed per scan and never used for model training. Full data isolation guaranteed by contract.',
  },
  {
    q: 'Do you offer on-premise deployment?',
    a: 'Enterprise tier supports VPC deployment on AWS. Full on-premise available for regulated industries.',
  },
  {
    q: 'When will OntoReview be SOC 2 certified?',
    a: 'SOC 2 Type II audit targeted for Q4 2026. Current infrastructure is SOC 2-ready.',
  },
  {
    q: 'Is OntoReview legal advice?',
    a: 'No. OntoReview is a decision-support and risk-monitoring tool. It does not constitute legal advice, and users should consult qualified counsel for all legal decisions. Exposure estimates are probabilistic projections based on historical settlement data, not guaranteed outcomes.',
  },
  {
    q: 'How is Estimated Legal Exposure calculated?',
    a: 'Exposure = Σ (matched precedent settlement × similarity score × severity weight) across all flagged reviews. We use 30+ US federal and state consumer-protection case settlements as anchors. Numbers are conservative upper-bound estimates intended for internal risk prioritization.',
  },
  {
    q: 'What is your liability in case of a missed risk?',
    a: 'Our Terms of Service cap OntoReview\'s aggregate liability at 12× monthly subscription fees. OntoReview supplements, but does not replace, your internal legal and compliance processes.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-faq__item">
      <button className="lp-faq__q" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="lp-faq__a">{a}</div>}
    </div>
  );
}

/* ── B2: Hero preview card with Executive/Technical toggle ── */
function HeroPreviewCard() {
  const [view, setView] = useState('executive');
  return (
    <div className="lp-preview">
      <div className="lp-preview__dots" />
      {/* B2: View toggle */}
      <div className="lp-preview__toggle">
        <button
          className={`lp-preview__toggle-btn${view === 'executive' ? ' is-active' : ''}`}
          onClick={() => setView('executive')}>
          Executive view
        </button>
        <button
          className={`lp-preview__toggle-btn${view === 'technical' ? ' is-active' : ''}`}
          onClick={() => setView('technical')}>
          Technical view
        </button>
      </div>
      <div className="lp-preview__chrome">
        <div className="lp-preview__chrome-left">LITIGATION INTELLIGENCE · LIVE</div>
        <div className="lp-preview__chrome-right">Beyond Meat · Plant-Based Burger Patty</div>
      </div>
      <div className="lp-preview__body">
        <div className="lp-preview__hero">
          <div>
            <div className="lp-preview__hero-l">
              {view === 'executive' ? 'Potential Legal Exposure' : 'Estimated Exposure'}
            </div>
            <div className="lp-preview__hero-n"><span className="hi">$5.40M</span></div>
            <div className="lp-preview__hero-sub">
              {view === 'executive'
                ? 'Based on matched US legal precedents'
                : 'Σ estimated_loss_usd · Nova 2 Lite'}
            </div>
          </div>
          <div className="lp-preview__hero-mini">
            <div className="lp-preview__hero-mini-n">12</div>
            <div className="lp-preview__hero-mini-l">
              {view === 'executive' ? 'High-risk signals' : 'Critical'}
            </div>
          </div>
        </div>
        <div className="lp-preview__rows">
          <div className="lp-preview__row is-crit">
            <span className="lp-preview__row-bar" />
            <div>
              <div className="lp-preview__row-title">Product Liability flagged</div>
              <div className="lp-preview__row-sub">
                {view === 'executive' ? 'Matched precedent · High severity' : 'FS-2023-ECOLI · cos 0.81'}
              </div>
            </div>
            <span className="lp-preview__row-sev">{view === 'executive' ? 'High' : '9'}</span>
          </div>
          <div className="lp-preview__row is-crit">
            <span className="lp-preview__row-bar" />
            <div>
              <div className="lp-preview__row-title">False Advertising signal</div>
              <div className="lp-preview__row-sub">
                {view === 'executive' ? 'Matched precedent · High severity' : 'FA-2022-LABEL · cos 0.74'}
              </div>
            </div>
            <span className="lp-preview__row-sev">{view === 'executive' ? 'High' : '8'}</span>
          </div>
          <div className="lp-preview__row">
            <span className="lp-preview__row-bar" />
            <div>
              <div className="lp-preview__row-title">Allergen disclosure review</div>
              <div className="lp-preview__row-sub">
                {view === 'executive' ? '42 reviews flagged · Medium severity' : 'CS-2020-ALRG · 42 reviews'}
              </div>
            </div>
            <span className="lp-preview__row-sev">{view === 'executive' ? 'Med' : '7'}</span>
          </div>
        </div>
        {view === 'executive' && (
          <div className="lp-preview__foot">Scanned in 90 seconds</div>
        )}
      </div>
    </div>
  );
}

/* ── Exposure calculation explainer ── */
function ExposureExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-exposure">
      <button className="lp-exposure__toggle" onClick={() => setOpen(!open)}>
        <span>How exposure is calculated</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="lp-exposure__body">
          <div className="lp-exposure__formula">
            <code>estimated_exposure = Σ (matched_precedent_settlement × similarity_score × severity)</code>
          </div>
          <div className="lp-exposure__example">
            <div className="lp-exposure__example-title">Example: Beyond Meat — Plant-Based Burger Patty</div>
            <div className="lp-exposure__steps">
              <div className="lp-exposure__step">
                <span className="lp-exposure__step-label">Review mentions</span>
                <span>"protein content misrepresentation"</span>
              </div>
              <div className="lp-exposure__step">
                <span className="lp-exposure__step-label">Matched to</span>
                <span>FTC v. Protein-Plus (2022 settlement: $3.2M) at 81% similarity</span>
              </div>
              <div className="lp-exposure__step">
                <span className="lp-exposure__step-label">Severity</span>
                <span>8/10 (FDA labeling violation pattern)</span>
              </div>
              <div className="lp-exposure__step">
                <span className="lp-exposure__step-label">Contribution</span>
                <span>This review contributes ~$2.1M to total exposure</span>
              </div>
              <div className="lp-exposure__step">
                <span className="lp-exposure__step-label">Total</span>
                <span>Across 1,284 reviews, 8 flagged items summed to <strong>$5.4M</strong></span>
              </div>
            </div>
          </div>
          <p className="lp-exposure__disclaimer">
            Estimates based on publicly available settlement data from 30+ US legal precedents
            (FDA, FTC, class-action databases). Not legal advice. Not a guarantee of outcome.
          </p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp-body">
      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <a className="lp-nav__brand" href="#top">
            <img src={markSvg} alt="" />
            <span>OntoReview</span>
          </a>
          <div className="lp-nav__links">
            <a href="#top">Home</a>
            <a href="#problem">Problem</a>
            <a href="#how-it-works">How it works</a>
            <a href="#product">Product</a>
            <a href="#market">Market</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <Link className="lp-nav__cta" to="/dashboard">Open Dashboard</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section id="top" className="lp-section lp-hero">
        <div className="lp-hero__grid">
          <div>
            <div className="lp-hero__pill">For Legal &amp; Compliance Teams</div>
            <h1 className="lp-hero__h1">
              Your next class-action is already in your review feed.<br />
              <span className="navy">OntoReview finds it before the plaintiff's lawyer does.</span>
            </h1>
            <p className="lp-hero__lede">
              We scan every review, match it to past settled cases, and show you the dollar risk
              before it becomes a lawsuit. One Beyond Meat scan found $5.4M in 90 seconds.
            </p>
            {/* B1: Primary CTA = Try Live Demo (large), Secondary = Watch 2-min Video (text link) */}
            <div className="lp-hero__ctas">
              <Link className="lp-btn lp-btn--pri lp-btn--lg" to="/dashboard"><Play size={14} /><span>Try Live Demo</span></Link>
              <button type="button" className="lp-hero__text-link" aria-disabled="true" title="Coming soon"><Video size={14} /><span>Watch 2-min Video</span></button>
            </div>
            {/* P1: Replace metrics with benefit-driven line */}
            <div className="lp-hero__benefits">
              Live in under 5 minutes · 500 reviews free · No credit card
            </div>
          </div>

          {/* B2: Dashboard preview with Executive/Technical toggle */}
          <HeroPreviewCard />
        </div>

        {/* Roadmap with status badges */}
        <div style={{ marginTop: 80 }}>
          <div className="lp-timeline">
            {[
              { status: 'shipped',     date: 'Q1 2026', title: 'Ontology v1',        body: '14 OWL classes spanning US food & CPG legal categories.' },
              { status: 'shipped',     date: 'Q2 2026', title: 'Nova Integration',    body: 'Amazon Nova 2 Lite wired to risk scoring and exposure estimation.' },
              { status: 'in-progress', date: 'Q3 2026', title: 'Audit & Compliance',  body: 'Append-only audit trail, role-based sharing, PDF export.' },
              { status: 'planned',     date: 'Q4 2026', title: 'Enterprise GA',       body: 'SSO, SOC 2 Type II, multi-jurisdiction coverage.' },
            ].map((n, i) => (
              <div key={i} className={`lp-timeline__node${n.status !== 'planned' ? ' is-active' : ''}`}>
                <div className="lp-timeline__dot" />
                <div className="lp-timeline__date">{n.date}</div>
                <div className="lp-timeline__title">
                  {n.title}
                  <span className={`lp-timeline__badge lp-timeline__badge--${n.status}`}>
                    {n.status === 'shipped' ? 'Shipped' : n.status === 'in-progress' ? 'In Progress' : 'Planned'}
                  </span>
                </div>
                <div className="lp-timeline__body">{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Case study teaser ── */}
      <section className="lp-casestudy">
        <div className="lp-casestudy__inner">
          <strong>Beyond Meat case study:</strong> OntoReview surfaced $5.4M of hidden exposure across 1,284 reviews in 90 seconds.
        </div>
      </section>

      {/* P3: Trust section — remove fake partner logos, keep quote only */}
      <section className="lp-trust">
        <p className="lp-trust__quote">Built with input from compliance attorneys at leading US food &amp; CPG companies.</p>
      </section>

      {/* ── Problem / Solution ── */}
      <section id="problem" className="lp-section">
        <div className="lp-section__label">Problem · Solution</div>
        <h2 className="lp-section__title">Legal teams are blind to the risk buried in review feeds.</h2>
        <p className="lp-section__sub">Every customer review is a potential deposition. At volume, the signal is impossible to catch manually — and the cost of missing one is measured in settlements.</p>

        <div className="lp-ps">
          <div className="lp-ps__col lp-ps__col--p">
            <div className="lp-ps__head"><AlertOctagon size={14} />Today</div>
            <div className="lp-ps__rows">
              {[
                'Manual review at scale is impossible — 10K+ reviews, 4 reviewers.',
                'Legal risk keywords get missed in the volume of five-star noise.',
                'No cross-functional sharing between Legal, Marketing, and C-level.',
                'No audit trail — regulators ask "when did you know?" and there is no answer.',
              ].map((t, i) => (
                <div key={i} className="lp-ps__row"><div className="lp-ps__num">{String(i+1).padStart(2,'0')}</div><div className="lp-ps__text">{t}</div></div>
              ))}
            </div>
          </div>
          <div className="lp-ps__col lp-ps__col--s">
            <div className="lp-ps__head"><CheckCircle2 size={14} />With OntoReview</div>
            <div className="lp-ps__rows">
              {[
                'OWL ontology auto-classifies every review into 14 legal categories.',
                'Amazon Nova LLM risk scoring with confidence intervals and precedent matches.',
                'Role-based views for Legal, Marketing, and C-level — one source of truth.',
                'Full action audit log, PDF-exportable for duty-of-care compliance.',
              ].map((t, i) => (
                <div key={i} className="lp-ps__row"><div className="lp-ps__num">{String(i+1).padStart(2,'0')}</div><div className="lp-ps__text">{t}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works (Classify → Match → Exposure → Prove) ── */}
      <section id="how-it-works" className="lp-section">
        <div className="lp-section__label">How it works</div>
        <h2 className="lp-section__title">Three steps from review to legal intelligence.</h2>
        <p className="lp-section__sub">Technical rigor under the hood, plain-English output on your dashboard.</p>

        <div className="lp-how">
          {[
            {
              step: '01',
              verb: 'CLASSIFY',
              bold: 'OWL Ontology matches reviews to 14 legal risk categories',
              grey: 'A legal taxonomy computers can actually reason over — like a lawyer\'s mental model, encoded.',
            },
            {
              step: '02',
              verb: 'MATCH',
              bold: 'Cosine similarity against 30 US legal precedents (e.g., cos 0.81)',
              grey: 'Shows how semantically similar each review is to a past settled case, on a 0-to-1 scale.',
            },
            {
              step: '03',
              verb: 'PROVE',
              bold: 'Append-only audit trail with role-based access',
              grey: 'Regulators can see exactly when you knew — no edits, no gaps.',
            },
          ].map((s, i) => (
            <div key={i} className="lp-how__step">
              <div className="lp-how__num">{s.step}</div>
              <div className="lp-how__verb">{s.verb}</div>
              <p className="lp-how__bold">{s.bold}</p>
              <p className="lp-how__grey">{s.grey}</p>
            </div>
          ))}
        </div>

        {/* P2: How exposure is calculated — collapsible panel */}
        <ExposureExplainer />
      </section>

      {/* ── Product (flagship full-width, others compact grid) ── */}
      <section id="product" className="lp-section">
        <div className="lp-section__label">Product</div>
        <h2 className="lp-section__title">Four modules today. Two more on the roadmap.</h2>
        <p className="lp-section__sub">Start in Risk Intelligence and branch into response, compliance, and ontology customization. Audit trail and agent automation ship Q3 2026.</p>

        <div className="lp-feature-hero">
          <div>
            <div className="lp-feature-hero__label">01 · Flagship · Risk Intelligence</div>
            <h3 className="lp-feature-hero__title">Every review, scored for legal exposure in real time.</h3>
            <p className="lp-feature-hero__body">The Risk Intelligence dashboard is the heart of OntoReview. Run a scan against any brand or SKU, watch Nova classify reviews against your OWL ontology, and see the precedent-matched exposure update in a single KPI.</p>
            <ul className="lp-feature-hero__list">
              <li>Total Legal Exposure KPI, driven by matched US precedent settlements.</li>
              <li>Severity timeline with cosine similarity and confidence per finding.</li>
              <li>One-click PDF export for Legal and C-level review.</li>
            </ul>
          </div>
          <div className="lp-feature-hero__visual">
            <div className="lp-preview__chrome" style={{ border: 0, padding: '0 0 12px', background: 'transparent' }}>
              <div className="lp-preview__chrome-left">LITIGATION INTELLIGENCE</div>
              <div className="lp-preview__chrome-right">Beyond Meat</div>
            </div>
            <div className="lp-preview__hero">
              <div>
                <div className="lp-preview__hero-l">Estimated Exposure</div>
                <div className="lp-preview__hero-n"><span className="hi">$5.40M</span></div>
                <div className="lp-preview__hero-sub">4 matched precedents</div>
              </div>
              <div className="lp-preview__hero-mini">
                <div className="lp-preview__hero-mini-n">1,284</div>
                <div className="lp-preview__hero-mini-l">Reviews</div>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-features lp-features--compact">
          {[
            { icon: ShieldCheck, num: '02', title: 'Risk Response Playbook', body: 'Nova-generated mitigation steps for each matched precedent and severity.' },
            { icon: Globe2, num: '03', title: 'Global Compliance Tracker', body: 'Multi-jurisdiction regulation checks across FDA, FTC, and state frameworks.' },
            { icon: GitBranch, num: '04', title: 'Domain Ontology Studio', body: 'Extend the OWL ontology with industry-specific classes and rules.' },
            { icon: ScrollText, num: '05', title: 'Trust & Safety Audit', body: 'Append-only audit log with PDF export for duty-of-care compliance.', soon: true },
            { icon: Bot, num: '06', title: 'Agent Communication Setup', body: 'Configure AI agent autonomy levels for automated response.', soon: true },
          ].map((f, i) => (
            <div key={i} className={`lp-feature${f.soon ? ' lp-feature--soon' : ''}`}>
              <div className="lp-feature__icon"><f.icon /></div>
              <div className="lp-feature__num">{f.num}{f.soon && <span className="lp-feature__soon-badge">Q3 2026</span>}</div>
              <h3 className="lp-feature__title">{f.title}</h3>
              <p className="lp-feature__body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech trust signal (3 pills only) ── */}
      <section id="technology" className="lp-section lp-section--tight">
        <div className="lp-section__label">Infrastructure</div>
        <div className="lp-stack">
          {['Amazon Nova 2 Lite', 'AWS Bedrock', 'SOC 2-ready infra'].map(t => (
            <span key={t} className="lp-stack__pill">{t}</span>
          ))}
        </div>
      </section>

      {/* ── Market (unified TAM/SAM/SOM) ── */}
      <section id="market" className="lp-section">
        <div className="lp-section__label">Market</div>
        <h2 className="lp-section__title">US food &amp; consumer goods legal tech, sized.</h2>
        <p className="lp-section__sub">We start where review volume meets regulatory risk: US food &amp; consumer goods brands selling on marketplaces.</p>

        <div className="lp-market">
          <div className="lp-rings">
            <svg viewBox="0 0 460 460">
              <circle cx="230" cy="230" r="210" fill="none" stroke="#E5E9F0" strokeWidth="1" />
              <circle cx="230" cy="230" r="210" fill="rgba(30,58,138,0.04)" />
              <circle cx="230" cy="230" r="140" fill="rgba(30,58,138,0.08)" stroke="rgba(30,58,138,0.2)" strokeWidth="1" />
              <circle cx="230" cy="230" r="70" fill="rgba(30,58,138,0.18)" stroke="var(--navy)" strokeWidth="1.5" />
              <text x="230" y="46" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" letterSpacing="0.1em" fill="#1E3A8A">TAM</text>
              <text x="230" y="66" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="14" fontWeight="500" fill="#1E3A8A">$14.2B</text>
              <text x="230" y="116" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" letterSpacing="0.1em" fill="#1E3A8A">SAM</text>
              <text x="230" y="136" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="14" fontWeight="500" fill="#1E3A8A">$2.4B</text>
              <text x="230" y="222" textAnchor="middle" fontFamily="Inter" fontSize="13" fontWeight="600" fill="#000">SOM</text>
              <text x="230" y="244" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="16" fontWeight="500" fill="#1E3A8A">$35–60M</text>
            </svg>
          </div>
          <div className="lp-market__list">
            {[
              { tag: 'TAM', label: 'Global review intelligence & legal tech', sub: 'All verticals, all geographies.', value: '$14.2B' },
              { tag: 'SAM', label: 'US food & consumer goods compliance', sub: 'Brands with ≥ 10K US reviews / year.', value: '$2.4B' },
              { tag: 'SOM', label: 'Mid-market food & CPG, US (bottom-up)', sub: '3,000–5,000 brands × 10–15% legal-team budget × $3,500 avg ACV', value: '$35–60M' },
            ].map((r, i) => (
              <div key={i} className="lp-market__row">
                <div className="lp-market__tag">{r.tag}</div>
                <div>
                  <div className="lp-market__label">{r.label}</div>
                  <div className="lp-market__sub">{r.sub}</div>
                </div>
                <div className="lp-market__value">{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Vertical expansion roadmap */}
        <div className="lp-market__expansion">
          <span>Expansion paths:</span>
          Phase 2 (2027): Pharma &amp; medical devices ($80M)
          <span className="lp-market__expansion-sep">|</span>
          Phase 3 (2028): Financial services ($30M)
          <span className="lp-market__expansion-sep">|</span>
          Phase 4 (2029): EU &amp; UK jurisdictions
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="lp-section">
        <div className="lp-section__label">Pricing</div>
        <h2 className="lp-section__title">Straight-line pricing, no legal tech markup.</h2>
        <p className="lp-section__sub">Try OntoReview free. Upgrade when your review volume or compliance footprint demands it.</p>
        <p className="lp-pricing__anchor">One prevented class-action typically costs $2M–$10M to defend. OntoReview Legal is less than 0.5% of that.</p>

        <div className="lp-pricing lp-pricing--4">
          {[
            {
              name: 'Free', amt: '$0', per: '1 brand · 500 reviews / mo', justify: null,
              features: ['Risk Intelligence dashboard', 'Precedent matching (30 cases)', 'CSV export'],
              cta: 'Start free', feat: false, sub: null,
            },
            {
              name: 'Team', amt: '$2,400', per: 'per month · up to 5 brands', justify: 'Early customers identified $60K+ in potential exposure per month.',
              features: ['Everything in Free', 'Response Playbooks (3 scenarios)', 'Risk alerts (email)', 'Up to 5,000 reviews / mo'],
              cta: 'Start Team trial', feat: false, sub: 'For small legal teams running monthly risk reviews.',
            },
            {
              name: 'Legal', amt: '$7,500', per: 'per month · up to 15 brands', justify: 'Early customers identified $240K+ in potential exposure per month.',
              features: ['Everything in Team', 'Append-only audit trail (duty-of-care)', 'PDF quarterly risk reports', 'Slack / Teams real-time alerts', 'Role-based sharing (Legal · Marketing · C-level)', 'Up to 50,000 reviews / mo'],
              cta: 'Talk to sales', feat: true, sub: 'For GCs preparing for regulatory audits.', href: 'mailto:sales@ontoreview.com',
            },
            {
              name: 'Enterprise', amt: 'Custom', per: 'starting $60K / year', justify: null,
              features: ['Everything in Legal', 'SSO, SOC 2 Type II', 'Custom OWL ontology', 'Multi-jurisdiction compliance (US + EU + KR)', 'Agent automation (Q3 2026)', 'Dedicated CS + legal-liaison contact'],
              cta: 'Contact sales', feat: false, sub: null, href: 'mailto:sales@ontoreview.com',
            },
          ].map((p, i) => (
            <div key={i} className={`lp-price${p.feat ? ' is-feat' : ''}`}>
              {p.feat && <div className="lp-price__badge">Most popular</div>}
              <div className="lp-price__name">{p.name}</div>
              <div className="lp-price__amt">{p.amt}</div>
              <div className="lp-price__per">{p.per}</div>
              {p.sub && <div className="lp-price__sub">{p.sub}</div>}
              {p.justify && <div className="lp-price__justify">{p.justify}</div>}
              <div className="lp-price__divider" />
              <ul className="lp-price__list">
                {p.features.map((f, j) => (
                  <li key={j}><Check size={14} /><span>{f}</span></li>
                ))}
              </ul>
              {p.href
                ? <a className="lp-price__cta" href={p.href}>{p.cta}</a>
                : <Link className="lp-price__cta" to="/onboarding">{p.cta}</Link>}
            </div>
          ))}
        </div>

        {/* Competitor comparison with framing */}
        <div className="lp-compare">
          <p className="lp-compare__intro">Legal teams don't currently have a dedicated tool — here's how adjacent solutions fall short.</p>
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th className="is-feat">OntoReview</th>
                <th>Trustpilot</th>
                <th>Bazaarvoice</th>
                <th>ReviewMeta</th>
              </tr>
            </thead>
            <tbody>
              {[
                { cap: 'Legal risk classification', or: { icon: Check, cls: 'ic-yes', text: 'OWL ontology, 14 classes' }, tp: { icon: X, cls: 'ic-no', text: 'Sentiment only' }, bv: { icon: X, cls: 'ic-no', text: 'Sentiment only' }, rm: { icon: Minus, cls: 'ic-mid', text: 'Authenticity only' } },
                { cap: 'Financial exposure estimate', or: { icon: Check, cls: 'ic-yes', text: 'Precedent-matched $' }, tp: { icon: X, cls: 'ic-no' }, bv: { icon: X, cls: 'ic-no' }, rm: { icon: X, cls: 'ic-no' } },
                { cap: 'Audit trail for compliance', or: { icon: Check, cls: 'ic-yes', text: 'Append-only, PDF' }, tp: { icon: Minus, cls: 'ic-mid', text: 'Basic log' }, bv: { icon: Check, cls: 'ic-yes' }, rm: { icon: X, cls: 'ic-no' } },
                { cap: 'Role-based sharing', or: { icon: Check, cls: 'ic-yes', text: 'Legal · Marketing · C-level' }, tp: { icon: Minus, cls: 'ic-mid', text: 'Marketing only' }, bv: { icon: Minus, cls: 'ic-mid', text: 'Marketing only' }, rm: { icon: X, cls: 'ic-no' } },
                { cap: 'LLM inference', or: { icon: Check, cls: 'ic-yes', text: 'Amazon Nova 2 Lite' }, tp: { icon: X, cls: 'ic-no' }, bv: { icon: Minus, cls: 'ic-mid', text: 'Proprietary' }, rm: { icon: X, cls: 'ic-no' } },
              ].map((row, i) => (
                <tr key={i}>
                  <td>{row.cap}</td>
                  {['or', 'tp', 'bv', 'rm'].map(k => {
                    const c = row[k];
                    return (
                      <td key={k} className={k === 'or' ? 'is-feat' : ''}>
                        <c.icon className={c.cls} size={14} /> {c.text || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="lp-section">
        <div className="lp-section__label">FAQ</div>
        <h2 className="lp-section__title">Common questions</h2>
        <div className="lp-faq">
          {FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── Closing ── */}
      <section className="lp-close">
        <h2 className="lp-close__h">Stop discovering lawsuits after they are filed.<br /><span className="navy">Find them in the reviews first.</span></h2>
        <p className="lp-close__p">OntoReview turns your review feed into a litigation early-warning system. Live in under five minutes.</p>
        {/* B1: Primary CTA repeated, "Start free" as tertiary text link */}
        <div className="lp-close__ctas">
          <Link className="lp-btn lp-btn--pri lp-btn--lg" to="/dashboard"><Play size={14} /><span>Try Live Demo</span></Link>
        </div>
        <Link className="lp-close__tertiary" to="/onboarding">or start free with sample data</Link>
      </section>

      {/* Footer — P3: advisory note replaces full section, Pitch Deck link */}
      <footer className="lp-foot">
        <div className="lp-foot__top">
          <span>&copy; 2026 OntoReview · Built on Amazon Nova 2 Lite · For US food &amp; consumer goods.</span>
          <span className="lp-foot__sep">·</span>
          <span className="lp-foot__note">Advisory board and launch partners to be announced Q3 2026.</span>
          <span className="lp-foot__sep">·</span>
          <button type="button" className="lp-foot__link" aria-disabled="true" title="Coming soon"><FileText size={12} /> Pitch Deck</button>
        </div>
        <div className="lp-foot__disclaimer">
          OntoReview provides decision-support information only. It is not legal advice. Consult qualified counsel for legal decisions.
        </div>
      </footer>
    </div>
  );
}

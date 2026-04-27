import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Shield, Users, FileText, Info, Sparkles,
  Utensils, Package, HeartPulse, MoreHorizontal, Scale, FileCheck,
  Megaphone, Star, User, ShoppingBag, Store, Upload, Check, Plus,
} from 'lucide-react';
import markSvg from '../assets/mark.svg';

const INDUSTRIES = [
  { id: 'food',   label: 'Food & Beverage',          Icon: Utensils },
  { id: 'cpg',    label: 'Consumer Packaged Goods',   Icon: Package },
  { id: 'health', label: 'Healthcare',                Icon: HeartPulse },
  { id: 'other',  label: 'Other',                     Icon: MoreHorizontal },
];

const VOLUMES = [
  { id: 'v1', label: '< 1K' },
  { id: 'v2', label: '1K–10K' },
  { id: 'v3', label: '10K–100K' },
  { id: 'v4', label: '100K+' },
];

const ROLES = [
  { id: 'legal',      title: 'Legal Counsel',       sub: 'See litigation signals and audit logs',           Icon: Scale },
  { id: 'compliance', title: 'Compliance Officer',  sub: 'See regulatory violations and FDA / FTC risk',    Icon: FileCheck },
  { id: 'marketing',  title: 'Marketing Leader',    sub: 'See brand sentiment and response playbooks',      Icon: Megaphone },
  { id: 'clevel',     title: 'C-level',             sub: 'See executive summary and cross-team metrics',    Icon: Star },
  { id: 'other',      title: 'Other',               sub: 'Customize later',                                 Icon: User },
];

const SOURCES = [
  { id: 'amazon',  title: 'Amazon',     sub: 'Connect via Seller Central API', badge: 'Most popular', Icon: ShoppingBag },
  { id: 'shopify', title: 'Shopify',    sub: 'Connect via Shopify Admin',      Icon: Store },
  { id: 'csv',     title: 'CSV Upload', sub: 'Drop a file with your reviews',  Icon: Upload },
];

const RISKS = [
  {
    category: 'False Advertising Claim',
    quote: '"Says 20g of protein on the package but my dietitian tested it and it\'s more like 14g. Total rip-off."',
    confidence: 0.84,
    why: <>This review questions a <strong>quantitative nutrition claim</strong> on the package. Reviews like this have triggered class-action settlements in similar cases (e.g. Plant-Based Protein Mislabeling, 2022).</>,
    crit: true,
  },
  {
    category: 'Undeclared Allergen',
    quote: '"I\'m severely allergic to soy. There\'s nothing on the label but I had a reaction within minutes of eating one."',
    confidence: 0.78,
    why: <>The reviewer describes an <strong>allergic reaction to an ingredient not listed on the label</strong>. This is the pattern FDA uses to initiate Class I recalls.</>,
    crit: true,
  },
  {
    category: 'Product Safety',
    quote: '"Opened the package and the patty was grey in the middle. Threw it out but my kid ate a bite and got sick."',
    confidence: 0.71,
    why: <>A reviewer reports <strong>illness after consumption</strong>. One complaint is noise; a cluster is a product-liability signal.</>,
    crit: false,
  },
];

/* ─────────────────── Welcome (Step 0) ─────────────────── */
function Welcome({ onStart }) {
  const navigate = useNavigate();
  return (
    <div className="ob-welcome">
      <div className="ob-welcome__top">
        <div className="ob-welcome__brand">
          <img src={markSvg} alt="OntoReview" />
          <span>OntoReview</span>
        </div>
        <button type="button" className="ob-top__skip" onClick={() => navigate('/dashboard')}>Sign in</button>
      </div>
      <div className="ob-welcome__body">
        <div className="ob-welcome__inner">
          <div className="ob-welcome__pill">Welcome</div>
          <h1 className="ob-welcome__h1">
            Find legal risk in your customer reviews <span className="navy">before it finds you.</span>
          </h1>
          <p className="ob-welcome__sub">
            OntoReview scans every review across Amazon, Shopify, and your site to flag
            false advertising claims, allergen issues, and class-action signals — automatically.
          </p>

          <div className="ob-welcome__cards">
            <div className="ob-out">
              <div className="ob-out__icon"><Shield /></div>
              <h3 className="ob-out__title">Know which reviews could become lawsuits</h3>
            </div>
            <div className="ob-out">
              <div className="ob-out__icon"><Users /></div>
              <h3 className="ob-out__title">Share findings with Legal, Marketing, and the C-suite</h3>
            </div>
            <div className="ob-out">
              <div className="ob-out__icon"><FileText /></div>
              <h3 className="ob-out__title">Audit trail for every decision</h3>
            </div>
          </div>

          <button className="ob-welcome__cta" onClick={onStart}>
            <span>Get started — 3 minutes</span>
            <ArrowRight size={16} />
          </button>
          <div className="ob-welcome__fine">No credit card. Sample data included.</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Shell for steps 1–4 ─────────────────── */
function StepShell({ step, children, onBack, onNext, nextLabel, backLabel = 'Back', hint, canNext = true }) {
  const navigate = useNavigate();
  const steps = [1, 2, 3, 4];
  return (
    <div className="ob-shell">
      <aside className="ob-rail">
        <div className="ob-rail__logo"><img src={markSvg} alt="" /></div>
        <div className="ob-rail__steps">
          {steps.map(n => {
            const cls = n === step ? 'is-active' : n < step ? 'is-done' : '';
            return (
              <div key={n} className={`ob-rail__step ${cls}`}>
                {n >= step && <span>{n}</span>}
              </div>
            );
          })}
        </div>
      </aside>
      <div className="ob-main">
        <div className="ob-top">
          <div className="ob-top__progress">
            <span className="ob-top__step">0{step}</span>
            <span className="ob-top__sep">/</span>
            <span className="ob-top__total">04</span>
            <span className="ob-top__name">{['Company', 'Role', 'Source', 'First findings'][step - 1]}</span>
          </div>
          <button type="button" className="ob-top__skip" onClick={() => navigate('/dashboard')}>Skip onboarding</button>
        </div>
        <div className="ob-body">
          <div className={step === 4 ? 'ob-result' : 'ob-content'}>
            {children}
          </div>
        </div>
        <div className="ob-foot">
          <div className="ob-foot__hint">{hint || ''}</div>
          <div className="ob-foot__buttons">
            <button className="lp-btn lp-btn--ghost" onClick={onBack}>
              <ArrowLeft size={14} /><span>{backLabel}</span>
            </button>
            <button className="lp-btn lp-btn--pri" onClick={onNext} disabled={!canNext}>
              <span>{nextLabel || 'Next'}</span><ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Step 1: Company ─────────────────── */
function Step1({ state, setState, onBack, onNext }) {
  return (
    <StepShell step={1} onBack={onBack} onNext={onNext} nextLabel="Next" backLabel="Welcome"
      hint="Your answers are saved as you go."
      canNext={state.company && state.industry && state.volume}>
      <div className="ob-eyebrow">Tell us about your company</div>
      <h1 className="ob-h1">A little context goes a long way.</h1>
      <p className="ob-lede">So we can tune the dashboard to what matters in your industry.</p>

      <div className="ob-helper">
        <Info size={16} />
        <span>We use this to benchmark you against similar companies and tune the risk rules for your industry.</span>
      </div>

      <div className="ob-field">
        <label>Company name</label>
        <input value={state.company} onChange={e => setState({ ...state, company: e.target.value })} placeholder="e.g. Beyond Meat" />
      </div>

      <div className="ob-field">
        <label>Industry</label>
        <div className="ob-grid">
          {INDUSTRIES.map(i => (
            <button key={i.id}
              className={`ob-card${state.industry === i.id ? ' is-active' : ''}`}
              onClick={() => setState({ ...state, industry: i.id })}>
              <div className="ob-card__icon"><i.Icon size={18} /></div>
              <h3 className="ob-card__title">{i.label}</h3>
            </button>
          ))}
        </div>
      </div>

      <div className="ob-field">
        <label>Approximate review volume per month</label>
        <div className="ob-volume">
          {VOLUMES.map(v => (
            <button key={v.id}
              className={`ob-volume__btn${state.volume === v.id ? ' is-active' : ''}`}
              onClick={() => setState({ ...state, volume: v.id })}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </StepShell>
  );
}

/* ─────────────────── Step 2: Role ─────────────────── */
function Step2({ state, setState, onBack, onNext }) {
  return (
    <StepShell step={2} onBack={onBack} onNext={onNext} nextLabel="Next"
      hint="You can change this later in Settings."
      canNext={!!state.role}>
      <div className="ob-eyebrow">Your role</div>
      <h1 className="ob-h1">What's most useful to you?</h1>
      <p className="ob-lede">We'll customize your dashboard and alerts based on what you need to see.</p>

      <div className="ob-helper">
        <Sparkles size={16} />
        <span>We'll customize your dashboard and alerts based on what you need to see.</span>
      </div>

      <div className="ob-grid ob-grid--1">
        {ROLES.map(r => (
          <button key={r.id}
            className={`ob-option${state.role === r.id ? ' is-active' : ''}`}
            onClick={() => setState({ ...state, role: r.id })}>
            <div className="ob-option__l">
              <div className="ob-option__icon"><r.Icon size={18} /></div>
              <div>
                <div className="ob-option__title">{r.title}</div>
                <div className="ob-option__sub">{r.sub}</div>
              </div>
            </div>
            <div className="ob-option__tick"><Check size={12} /></div>
          </button>
        ))}
      </div>
    </StepShell>
  );
}

/* ─────────────────── Step 3: Connect ─────────────────── */
function Step3({ state, setState, onBack, onNext }) {
  return (
    <StepShell step={3} onBack={onBack} onNext={onNext} nextLabel="Run first analysis"
      hint="You can connect more sources anytime."
      canNext={true}>
      <div className="ob-eyebrow">Connect your first review source</div>
      <h1 className="ob-h1">Where should we look?</h1>
      <p className="ob-lede">Pick one source to start. You can always add more later.</p>

      <div className="ob-helper">
        <Info size={16} />
        <span>Don't have an account ready? Use our sample dataset — you can connect real sources anytime later.</span>
      </div>

      <div className="ob-grid ob-grid--1">
        {SOURCES.map(s => (
          <button key={s.id}
            className={`ob-option${state.source === s.id ? ' is-active' : ''}`}
            onClick={() => setState({ ...state, source: s.id })}>
            <div className="ob-option__l">
              <div className="ob-option__icon"><s.Icon size={18} /></div>
              <div>
                <div className="ob-option__title">{s.title}</div>
                <div className="ob-option__sub">{s.sub}</div>
              </div>
            </div>
            {s.badge && <div className="ob-card__badge" style={{ position: 'static' }}>{s.badge}</div>}
            {!s.badge && <div className="ob-option__tick"><Check size={12} /></div>}
          </button>
        ))}
      </div>

      <button type="button" className="ob-skiplink" onClick={() => { setState({ ...state, source: 'sample' }); onNext(); }}>
        <ArrowRight size={13} />
        <span>Skip — use sample dataset (Beyond Meat reviews, 500 samples)</span>
      </button>
    </StepShell>
  );
}

/* ─────────────────── Step 4: Result ─────────────────── */
function Step4({ onBack, onFinish }) {
  const navigate = useNavigate();
  return (
    <StepShell step={4} onBack={onBack} onNext={onFinish} nextLabel="Go to full dashboard"
      hint="Sample data — your real results will appear once connected."
      canNext={true}>
      <div className="ob-result__kicker">Here's what we found in the sample dataset</div>
      <h1 className="ob-result__title">Beyond Meat · Plant-Based Burger Patty</h1>
      <p className="ob-result__sub">500 reviews analyzed from Amazon and Shopify over the last 90 days.</p>

      <div className="ob-metrics">
        <div className="ob-metric">
          <div className="ob-metric__l">Reviews scanned</div>
          <div className="ob-metric__v">127</div>
          <div className="ob-metric__s">Last 90 days</div>
        </div>
        <div className="ob-metric">
          <div className="ob-metric__l">Flagged for review</div>
          <div className="ob-metric__v">8</div>
          <div className="ob-metric__s">6.3% of total</div>
        </div>
        <div className="ob-metric">
          <div className="ob-metric__l">High-priority</div>
          <div className="ob-metric__v">3</div>
          <div className="ob-metric__bar"><div className="ob-metric__bar-fill" style={{ width: '72%' }} /></div>
        </div>
        <div className="ob-metric">
          <div className="ob-metric__l">Estimated exposure</div>
          <div className="ob-metric__v"><span className="hi">$2.4M</span></div>
          <div className="ob-metric__s">Based on similar settlements</div>
        </div>
      </div>

      <div className="ob-riskh">
        <div className="ob-riskh__l">Top 3 risk signals</div>
        <div className="ob-riskh__r">Sorted by confidence</div>
      </div>

      <div className="ob-risks">
        {RISKS.map((r, i) => (
          <div key={i} className={`ob-risk${r.crit ? ' is-crit' : ''}`}>
            <div className="ob-risk__bar" />
            <div className="ob-risk__body">
              <div className="ob-risk__head">
                <div className="ob-risk__cat">{r.category}</div>
                <div className="ob-risk__conf">
                  <span className="ob-risk__conf-l">Confidence</span>
                  <div className="ob-risk__conf-bar"><div className="ob-risk__conf-fill" style={{ width: `${r.confidence * 100}%` }} /></div>
                  <span className="ob-risk__conf-val">{Math.round(r.confidence * 100)}%</span>
                </div>
              </div>
              <div className="ob-risk__quote">{r.quote}</div>
              <div className="ob-risk__why">
                <div className="ob-risk__why-icon"><Info size={14} /></div>
                <div className="ob-risk__why-text"><strong>Why this was flagged —</strong> {r.why}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 20 }}>
        <button type="button" className="ob-skiplink" onClick={() => navigate('/dashboard')}>
          <Plus size={13} />
          <span>Connect my own data source instead</span>
        </button>
      </div>
    </StepShell>
  );
}

/* ─────────────────── App ─────────────────── */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState({
    company: 'Beyond Meat',
    industry: 'food',
    volume: 'v3',
    role: 'legal',
    source: 'sample',
  });

  if (step === 0) return <Welcome onStart={() => setStep(1)} />;
  if (step === 1) return <Step1 state={state} setState={setState} onBack={() => setStep(0)} onNext={() => setStep(2)} />;
  if (step === 2) return <Step2 state={state} setState={setState} onBack={() => setStep(1)} onNext={() => setStep(3)} />;
  if (step === 3) return <Step3 state={state} setState={setState} onBack={() => setStep(2)} onNext={() => setStep(4)} />;
  return <Step4 onBack={() => setStep(3)} onFinish={() => navigate('/dashboard')} />;
}

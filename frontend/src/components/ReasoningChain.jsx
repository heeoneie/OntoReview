import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

const REGULATION_MAP = {
  ProductLiability: 'FDA Cosmetic Safety Act (21 CFR 740)',
  ClassAction: 'Consumer Product Safety Act',
  ConsumerFraud: 'FTC Act Section 5',
};

function classifyItem(item) {
  const cid = item.case_id || '';
  if (cid.startsWith('PL-')) return 'ProductLiability';
  if (cid.startsWith('CA-')) return 'ClassAction';
  if (cid.startsWith('FA-')) return 'ConsumerFraud';
  return 'RiskEvent';
}

export default function ReasoningChain({ timeline, kpi, visible }) {
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setMounted(true), 60);
      return () => clearTimeout(timer);
    }
    setMounted(false);
  }, [visible]);

  if (!visible || !timeline || timeline.length === 0) return null;

  const item = timeline.reduce((best, cur) => (cur.severity > best.severity ? cur : best), timeline[0]);
  if (!item) return null;

  const owlClass = classifyItem(item);
  const regulation = REGULATION_MAP[owlClass] || 'US Federal Regulation';
  const exposure = kpi?.total_legal_exposure_usd || 0;

  const steps = [
    {
      label: t('reasoning.step1'),
      content: item.name,
      sub: null,
      style: 'bg-zinc-800/60 border-zinc-700',
    },
    {
      label: t('reasoning.step2'),
      content: owlClass,
      sub: `${t('reasoning.severity')}: ${item.severity}`,
      style: 'bg-zinc-800/80 border-zinc-600',
    },
    {
      label: t('reasoning.step3'),
      content: regulation,
      sub: null,
      style: 'bg-zinc-800/60 border-zinc-700',
    },
    {
      label: t('reasoning.step4'),
      content: item.case_id || 'Matched Legal Precedent',
      sub: null,
      style: 'bg-zinc-800/60 border-zinc-700',
    },
    {
      label: t('reasoning.step5'),
      content: `$${exposure.toLocaleString()}`,
      sub: null,
      style: 'bg-zinc-800/80 border-zinc-600',
      isExposure: true,
    },
  ];

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="text-white" size={15} />
        <span className="text-sm font-semibold text-white">{t('reasoning.title')}</span>
      </div>

      <div className="max-w-md mx-auto">
        {steps.map((step, i) => (
          <div key={i}>
            {/* Connector line + arrow */}
            {i > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-zinc-700" />
                <span className="text-zinc-600 text-sm leading-none">&#9660;</span>
                <div className="w-px h-2 bg-zinc-700" />
              </div>
            )}

            {/* Step card */}
            <div
              className={`rounded-xl px-4 py-3 border transition-all duration-500 ease-out ${step.style} ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
              style={{ transitionDelay: `${i * 200}ms` }}
            >
              <p className="text-sm uppercase tracking-wide text-zinc-500 font-medium mb-1">
                {step.label}
              </p>
              <p
                className={`font-medium leading-snug ${
                  step.isExposure
                    ? exposure > 0
                      ? 'text-3xl text-white font-bold tabular-nums'
                      : 'text-3xl text-zinc-400 font-bold tabular-nums'
                    : 'text-sm text-white'
                }`}
              >
                {step.content}
              </p>
              {step.sub && (
                <p className="text-sm text-zinc-400 mt-1 font-medium">{step.sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

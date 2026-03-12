import CountUp from 'react-countup';
import { Scale, AlertTriangle, TrendingUp, FileText } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import RiskReport from './RiskReport';

function formatLegalExposure(amount) {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

export default function ExposureHero({ kpi, timeline, auditEvents, amazonUrl, scanId, discoveryResults }) {
  const { t } = useLang();

  const exposure = kpi.total_legal_exposure_usd;

  const cards = [
    {
      icon: Scale,
      label: t('exposure.title'),
      value: exposure > 0 ? (
        <CountUp
          end={exposure}
          duration={2.5}
          formattingFn={formatLegalExposure}
        />
      ) : '$0',
    },
    {
      icon: AlertTriangle,
      label: t('exposure.criticalRisks'),
      value: kpi.critical_risks_detected,
    },
    {
      icon: FileText,
      label: t('exposure.reviewsAnalyzed'),
      value: kpi.total_scanned_reviews,
    },
    {
      icon: TrendingUp,
      label: t('exposure.severityScore'),
      value: kpi.overall_risk_score,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div />
        <RiskReport kpi={kpi} timeline={timeline} auditEvents={auditEvents} amazonUrl={amazonUrl} scanId={scanId} discoveryResults={discoveryResults} />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="text-zinc-400" size={16} />
                <span className="text-sm text-zinc-400 font-medium">{card.label}</span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums leading-none">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

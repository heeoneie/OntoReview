import { useState } from 'react';
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
  const [showTooltip, setShowTooltip] = useState(false);

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
      label: t('exposure.riskFlags'),
      value: kpi.critical_risks_detected,
      suffix: kpi.total_scanned_reviews > 0
        ? t('exposure.riskFlagsSuffix').replace('{count}', kpi.total_scanned_reviews)
        : null,
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
          const isExposure = i === 0;
          return (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-5 relative"
              tabIndex={isExposure ? 0 : undefined}
              onMouseEnter={isExposure ? () => setShowTooltip(true) : undefined}
              onMouseLeave={isExposure ? () => setShowTooltip(false) : undefined}
              onFocus={isExposure ? () => setShowTooltip(true) : undefined}
              onBlur={isExposure ? () => setShowTooltip(false) : undefined}
              aria-describedby={isExposure ? 'exposure-tooltip' : undefined}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="text-zinc-400" size={16} />
                <span className="text-sm text-zinc-400 font-medium">{card.label}</span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums leading-none">
                {card.value}
              </p>
              {card.suffix && (
                <p className="text-xs text-zinc-500 mt-1">{card.suffix}</p>
              )}
              {isExposure && showTooltip && (
                <div id="exposure-tooltip" role="tooltip" className="absolute left-0 top-full mt-2 z-20 w-80 bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-xl">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {t('exposure.tooltipLine1')}<br />
                    {t('exposure.tooltipLine2').replace('{count}', kpi.total_scanned_reviews)}<br />
                    {t('exposure.tooltipLine3')}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

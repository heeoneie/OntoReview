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
  const hasRisk = exposure > 0 || kpi.critical_risks_detected > 0;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${
      hasRisk
        ? 'border-amber-800/60 bg-gradient-to-br from-amber-950/40 via-zinc-900 to-zinc-900'
        : 'border-zinc-800 bg-zinc-900'
    }`}>
      {/* Subtle grid texture */}
      {hasRisk && (
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(245,158,11,.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
      )}

      <div className="relative px-8 py-8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2 w-2 ${hasRisk ? '' : 'opacity-50'}`}>
              {hasRisk && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${hasRisk ? 'bg-amber-400' : 'bg-zinc-500'}`} />
            </span>
            <span className={`text-[11px] font-bold uppercase tracking-[.15em] ${hasRisk ? 'text-amber-400' : 'text-zinc-500'}`}>
              {t('exposure.title')}
            </span>
          </div>
          <RiskReport kpi={kpi} timeline={timeline} auditEvents={auditEvents} amazonUrl={amazonUrl} scanId={scanId} discoveryResults={discoveryResults} />
        </div>

        {/* Big exposure number */}
        <p className={`text-5xl font-bold tracking-tight tabular-nums leading-none ${
          hasRisk ? 'text-amber-400' : 'text-zinc-500'
        }`}>
          {exposure > 0 ? (
            <CountUp
              end={exposure}
              duration={2.5}
              formattingFn={formatLegalExposure}
            />
          ) : (
            '$0'
          )}
        </p>
        {exposure > 0 && (
          <p className="text-xs text-amber-500/70 mt-2 max-w-md">
            {t('risk.legalExposureTooltip')}
          </p>
        )}

        {/* Sub-KPI row */}
        <div className="flex items-center gap-6 mt-6 pt-5 border-t border-zinc-800/50">
          {/* Critical Risks */}
          <div className="flex items-center gap-2">
            <AlertTriangle className={kpi.critical_risks_detected > 0 ? 'text-amber-400' : 'text-zinc-600'} size={14} />
            <span className="text-sm tabular-nums text-white font-semibold">{kpi.critical_risks_detected}</span>
            <span className="text-xs text-zinc-500">{t('exposure.criticalRisks')}</span>
          </div>

          <div className="w-px h-4 bg-zinc-800" />

          {/* Reviews Analyzed */}
          <div className="flex items-center gap-2">
            <FileText className="text-zinc-600" size={14} />
            <span className="text-sm tabular-nums text-white font-semibold">{kpi.total_scanned_reviews}</span>
            <span className="text-xs text-zinc-500">{t('exposure.reviewsAnalyzed')}</span>
          </div>

          <div className="w-px h-4 bg-zinc-800" />

          {/* Risk Score */}
          <div className="flex items-center gap-2">
            <TrendingUp className={kpi.overall_risk_score >= 10 ? 'text-amber-400' : 'text-zinc-600'} size={14} />
            <span className={`text-sm tabular-nums font-semibold ${kpi.overall_risk_score >= 10 ? 'text-amber-400' : 'text-white'}`}>
              {kpi.overall_risk_score}
            </span>
            <span className="text-xs text-zinc-500">{t('exposure.severityScore')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

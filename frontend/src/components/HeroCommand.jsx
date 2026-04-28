import { Loader2, Rocket } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

const INDUSTRIES = [
  { id: 'ecommerce', labelKey: 'risk.ecommerce' },
  { id: 'hospital',  labelKey: 'risk.hospital' },
  { id: 'finance',   labelKey: 'risk.finance' },
];

export default function HeroCommand({
  expanded = true,
  // Industry & brand
  industry,
  onIndustryChange,
  brandName,
  brandLabel,
  productName,
  productLabel,
  // Actions
  onRunAnalysis,
  // Loading
  analysisLoading,
}) {
  const { t } = useLang();

  /* ── Compact mode — thin command bar after scan ── */
  if (!expanded) {
    return (
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-5 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-white opacity-40" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            {t('hero.eyebrow')}
          </span>
        </div>

        <div className="flex-1 flex items-center gap-2 text-sm text-zinc-300">
          <span className="font-medium text-white">{brandName}</span>
          {productName && (
            <>
              <span className="text-zinc-600">&middot;</span>
              <span className="text-zinc-400">{productName}</span>
            </>
          )}
        </div>

        <button
          onClick={onRunAnalysis}
          disabled={analysisLoading}
          className="px-4 py-1.5 bg-white text-zinc-950 rounded-lg text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          {analysisLoading ? <Loader2 className="animate-spin" size={12} /> : <Rocket size={12} />}
          {t('hero.reanalyze')}
        </button>
      </div>
    );
  }

  /* ── Expanded hero ── */
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {/* Dot grid texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative px-8 py-10">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-white opacity-40" />
            <span className="relative h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-[.15em] text-zinc-500">
            {t('hero.eyebrow')}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold text-white tracking-tight leading-tight mb-1">
          {t('hero.headline1')}<br />
          <span className="text-zinc-500">{t('hero.headline2')}</span>
        </h1>
        <p className="text-sm text-zinc-600 mb-8 max-w-lg">
          {t('hero.pipeline')}
        </p>

        {/* Industry pills */}
        <div className="flex gap-1.5 mb-5">
          {INDUSTRIES.map(({ id, labelKey }) => (
            <button
              key={id}
              onClick={() => onIndustryChange(id)}
              disabled={analysisLoading}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                industry === id
                  ? 'bg-zinc-700 text-white border-zinc-600'
                  : 'bg-zinc-800/60 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
              } disabled:opacity-50`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Brand + Product + CTA — labels on top, button aligned right */}
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm text-zinc-500 uppercase tracking-wider font-medium mb-1.5">{brandLabel}</label>
            <input
              type="text"
              value={brandName}
              readOnly
              placeholder={brandLabel}
              disabled={analysisLoading}
              className="w-44 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors disabled:opacity-50 cursor-default"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm text-zinc-500 uppercase tracking-wider font-medium mb-1.5">{productLabel}</label>
            <input
              type="text"
              value={productName}
              readOnly
              placeholder={productLabel}
              disabled={analysisLoading}
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors disabled:opacity-50 cursor-default"
            />
          </div>

          <button
            onClick={onRunAnalysis}
            disabled={analysisLoading}
            className="px-5 py-2 bg-white text-zinc-950 rounded-lg font-semibold hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2 transition-all text-sm shadow-[0_0_20px_rgba(255,255,255,.08)] flex-shrink-0"
          >
            {analysisLoading ? <Loader2 className="animate-spin" size={14} /> : <Rocket size={14} />}
            {t('hero.runAnalysis')}
          </button>
        </div>
      </div>
    </div>
  );
}

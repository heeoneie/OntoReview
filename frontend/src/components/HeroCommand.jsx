import { Loader2, Rocket, ScanSearch, Zap } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

const INDUSTRIES = [
  { id: 'ecommerce', labelKey: 'risk.ecommerce' },
  { id: 'hospital',  labelKey: 'risk.hospital' },
  { id: 'finance',   labelKey: 'risk.finance' },
  { id: 'gaming',    labelKey: 'risk.gaming' },
];

export default function HeroCommand({
  expanded = true,
  // Industry & brand
  industry,
  onIndustryChange,
  brandName,
  onBrandChange,
  brandLabel,
  productName,
  onProductChange,
  productLabel,
  // Amazon URL
  amazonUrl,
  onAmazonUrlChange,
  // Actions
  onRunFullDemo,
  onAmazonIngest,
  onBrandSearch,
  // Loading
  fullDemoLoading,
  amazonLoading,
  brandSearchLoading,
  // Toast
  amazonToast,
  amazonToastType,
}) {
  const { t } = useLang();
  const isAnyLoading = fullDemoLoading || amazonLoading || brandSearchLoading;

  /* ── Compact mode — thin command bar ── */
  if (!expanded) {
    return (
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-5 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-sky-400 opacity-40" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-sky-400" />
          </span>
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {t('hero.eyebrow')}
          </span>
        </div>

        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={amazonUrl}
            onChange={(e) => onAmazonUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAmazonIngest()}
            placeholder={t('hero.urlPlaceholder')}
            className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {amazonUrl.trim() && (
            <button
              onClick={onAmazonIngest}
              disabled={amazonLoading || !amazonUrl.trim()}
              className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 transition-colors"
            >
              {amazonLoading ? <Loader2 className="animate-spin" size={12} /> : <ScanSearch size={12} />}
            </button>
          )}
        </div>

        <button
          onClick={onRunFullDemo}
          disabled={isAnyLoading}
          className="px-4 py-1.5 bg-white text-zinc-950 rounded-lg text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          {fullDemoLoading ? <Loader2 className="animate-spin" size={12} /> : <Rocket size={12} />}
          {t('hero.rescan')}
        </button>

        {amazonToast && (
          <span className={`text-[11px] font-medium flex-shrink-0 ${amazonToastType === 'error' ? 'text-amber-400' : 'text-sky-400'}`}>
            {amazonToast}
          </span>
        )}
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
            <span className="animate-ping absolute h-full w-full rounded-full bg-sky-400 opacity-40" />
            <span className="relative h-2 w-2 rounded-full bg-sky-400" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[.15em] text-zinc-500">
            {t('hero.eyebrow')}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-bold text-white tracking-tight leading-tight mb-1">
          {t('hero.headline1')}<br />
          <span className="text-zinc-500">{t('hero.headline2')}</span>
        </h1>
        <p className="text-sm text-zinc-600 mb-8 max-w-lg">
          {t('hero.pipeline')}
        </p>

        {/* Primary CTA row */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onRunFullDemo}
            disabled={isAnyLoading}
            className="px-6 py-3 bg-white text-zinc-950 rounded-xl font-semibold hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2.5 transition-all text-sm shadow-[0_0_20px_rgba(255,255,255,.08)] flex-shrink-0"
          >
            {fullDemoLoading ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
            {t('hero.runBtn')}
          </button>

          <span className="text-xs text-zinc-700">{t('hero.or')}</span>

          {/* Inline URL input */}
          <div className="flex-1 max-w-md flex gap-2">
            <input
              type="text"
              value={amazonUrl}
              onChange={(e) => onAmazonUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAmazonIngest()}
              placeholder={t('hero.urlPlaceholder')}
              className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <button
              onClick={onAmazonIngest}
              disabled={amazonLoading || !amazonUrl.trim() || fullDemoLoading}
              className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors text-sm border border-zinc-700"
            >
              {amazonLoading ? <Loader2 className="animate-spin" size={14} /> : <ScanSearch size={14} />}
            </button>
          </div>
        </div>

        {/* Toast */}
        {amazonToast && (
          <p className={`mb-4 text-xs font-medium ${amazonToastType === 'error' ? 'text-amber-400' : 'text-sky-400'}`}>
            {amazonToast}
          </p>
        )}

        {/* Divider — Brand Analysis */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 border-t border-zinc-800" />
          <span className="text-[11px] text-zinc-600 font-medium uppercase tracking-wide">
            {t('hero.brandAnalysis')}
          </span>
          <div className="flex-1 border-t border-zinc-800" />
        </div>

        {/* Industry pills + Brand/Product inputs */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {INDUSTRIES.map(({ id, labelKey }) => (
              <button
                key={id}
                onClick={() => onIndustryChange(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  industry === id
                    ? 'bg-zinc-700 text-white border-zinc-600'
                    : 'bg-zinc-800/60 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={brandName}
            onChange={(e) => onBrandChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isAnyLoading && onBrandSearch()}
            placeholder={brandLabel}
            className="w-36 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />

          <input
            type="text"
            value={productName}
            onChange={(e) => onProductChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isAnyLoading && onBrandSearch()}
            placeholder={productLabel}
            className="flex-1 min-w-[120px] bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />

          <button
            onClick={onBrandSearch}
            disabled={isAnyLoading || (!brandName.trim() && !productName.trim())}
            className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            {brandSearchLoading ? <Loader2 className="animate-spin" size={12} /> : <Zap size={12} />}
            {t('hero.analyzeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useLang } from '../contexts/LangContext';

function SectionHeader({ label, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-3 bg-sky-500 rounded-full" />
      <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-zinc-500">
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="text-[11px] text-zinc-600 tabular-nums">{count}</span>
      )}
      <div className="flex-1 border-t border-zinc-800/50" />
    </div>
  );
}

export default function InvestigationWorkspace({
  left,
  right,
  leftCount,
  rightCount,
  graphSubtitle,
}) {
  const { t } = useLang();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left column — Evidence Feed (3/5) */}
      <div className="lg:col-span-3 space-y-5">
        <SectionHeader label={t('hero.evidenceFeed')} count={leftCount} />
        {left}
      </div>

      {/* Right column — Knowledge Graph (2/5) */}
      <div className="lg:col-span-2">
        <div className="mb-3">
          <SectionHeader label={t('hero.knowledgeGraph')} count={rightCount} />
          {graphSubtitle && (
            <p className="text-[11px] text-zinc-600 -mt-1.5 ml-3">{graphSubtitle}</p>
          )}
        </div>
        <div className="lg:sticky lg:top-20">
          {right}
        </div>
      </div>
    </div>
  );
}

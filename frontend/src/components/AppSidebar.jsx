import { Search, Shield, FileCheck, Settings2, ScrollText, Bot } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'intelligence', icon: Search,    labelKo: '인텔리전스', labelEn: 'Intel',    tooltip: 'Scan & score reviews' },
  { id: 'response',     icon: Shield,    labelKo: '대응',       labelEn: 'Response', tooltip: 'AI-generated playbook' },
  { id: 'compliance',   icon: FileCheck, labelKo: '컴플라이언스', labelEn: 'Comply',  tooltip: 'Multi-jurisdiction check' },
  { id: 'studio',       icon: Settings2, labelKo: '스튜디오',   labelEn: 'Studio',   tooltip: 'Customize ontology' },
];

const COMING_SOON = [
  { id: 'audit', icon: ScrollText, labelEn: 'Audit',  tooltip: 'Coming Q3 2026' },
  { id: 'agent', icon: Bot,        labelEn: 'Agent',  tooltip: 'Coming Q3 2026' },
];

export default function AppSidebar({ activeTab, onTabChange, lang, onLangToggle }) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[72px] bg-zinc-900 border-r border-zinc-800 flex flex-col items-center z-50">
      {/* Logo + tagline */}
      <div className="flex flex-col items-center pt-3 pb-1 gap-1">
        <span className="text-white text-lg font-black select-none">◆</span>
        <span className="text-[7px] text-zinc-500 font-medium text-center leading-tight px-1 tracking-wide">
          LITIGATION<br />INTELLIGENCE
        </span>
      </div>

      {/* Nav icons + labels */}
      <nav className="flex-1 flex flex-col items-center gap-1 pt-2">
        {NAV_ITEMS.map(({ id, icon: Icon, labelKo, labelEn, tooltip }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              title={tooltip}
              className={`group relative w-14 flex flex-col items-center justify-center gap-0.5 py-2 rounded-md transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-white" />
              )}
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[9px] font-medium leading-tight text-center">
                {lang === 'ko' ? labelKo : labelEn}
              </span>
            </button>
          );
        })}

        {/* Separator */}
        <div className="w-8 h-px bg-zinc-800 my-1" />

        {/* Coming soon tabs */}
        {COMING_SOON.map(({ id, icon: Icon, labelEn, tooltip }) => (
          <div
            key={id}
            title={tooltip}
            className="relative w-14 flex flex-col items-center justify-center gap-0.5 py-2 rounded-md text-zinc-700 cursor-default opacity-40"
          >
            <Icon size={20} strokeWidth={1.5} />
            <span className="text-[9px] font-medium leading-tight text-center">{labelEn}</span>
            <span className="absolute -top-0.5 -right-0.5 text-[6px] font-bold text-zinc-500 bg-zinc-800 px-1 rounded">Q3</span>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-3 pb-4">
        <div className="flex flex-col items-center gap-0.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[9px] text-emerald-400 font-bold tracking-widest">LIVE</span>
        </div>

        <button
          onClick={onLangToggle}
          className="w-8 h-8 flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-700 rounded-md hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          {lang === 'ko' ? 'EN' : '한'}
        </button>
      </div>
    </aside>
  );
}

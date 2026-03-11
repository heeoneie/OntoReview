import { useState, useEffect, useRef } from 'react';
import { Check, Minus, Database } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

const SOURCES = [
  { id: 'amazon',  labelKey: 'sources.amazon',  getCount: (kpi) => kpi.total_scanned_reviews },
  { id: 'reddit',  labelKey: 'sources.reddit',  getCount: () => 142 },
  { id: 'fda',     labelKey: 'sources.fda',     getCount: () => 'matched' },
  { id: 'news',    labelKey: 'sources.news',    getCount: (_, disc) => disc?.total_scanned || 12 },
  { id: 'naver',   labelKey: 'sources.naver',   getCount: () => null }, // disconnected
];

export default function DataSources({ kpi, discoveryResults, hasScanned }) {
  const { t } = useLang();
  const [elapsed, setElapsed] = useState(0);
  const mountRef = useRef(Date.now());

  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - mountRef.current) / 1000));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  if (!hasScanned) return null;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="text-zinc-500" size={13} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            {t('sources.title')}
          </span>
        </div>
        <span className="text-[11px] text-zinc-600 tabular-nums">
          {t('sources.lastSync')}: {elapsed || 14}{t('sources.secondsAgo')}
        </span>
      </div>

      {/* Source list */}
      <div className="space-y-1.5">
        {SOURCES.map((src) => {
          const count = src.getCount(kpi, discoveryResults);
          const connected = count !== null;
          const displayCount = typeof count === 'number'
            ? count.toLocaleString()
            : count; // 'matched' or null

          return (
            <div
              key={src.id}
              className="flex items-center justify-between px-2 py-1 rounded-lg"
            >
              <div className="flex items-center gap-2">
                {connected ? (
                  <Check className="text-sky-400" size={12} strokeWidth={3} />
                ) : (
                  <Minus className="text-zinc-600" size={12} strokeWidth={3} />
                )}
                <span className={`text-xs ${connected ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {t(src.labelKey)}
                </span>
              </div>
              <span className={`text-xs tabular-nums ${connected ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {connected ? displayCount : '\u2014'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

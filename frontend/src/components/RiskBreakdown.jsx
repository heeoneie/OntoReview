import { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

const CATEGORY_COLORS = {
  ProductLiability: '#f59e0b',
  ClassAction:      '#ef4444',
  ConsumerFraud:    '#8b5cf6',
  FoodSafety:       '#10b981',
  RegulatoryRisk:   '#3b82f6',
  Other:            '#6b7280',
};

function classifyByCase(caseId) {
  if (!caseId) return 'Other';
  if (caseId.startsWith('PL-')) return 'ProductLiability';
  if (caseId.startsWith('CA-')) return 'ClassAction';
  if (caseId.startsWith('FA-')) return 'ConsumerFraud';
  return 'Other';
}

export default function RiskBreakdown({ timeline }) {
  const { t } = useLang();

  const breakdown = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];

    const counts = {};
    for (const item of timeline) {
      const cat = classifyByCase(item.case_id);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    const total = timeline.length;
    return Object.entries(counts)
      .map(([cat, count]) => ({
        category: cat,
        count,
        pct: Math.round((count / total) * 100),
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other,
      }))
      .sort((a, b) => b.count - a.count);
  }, [timeline]);

  if (breakdown.length === 0) return null;

  // SVG donut chart
  const total = breakdown.reduce((s, b) => s + b.count, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="text-zinc-500" size={13} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          {t('graph.breakdown')}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Donut */}
        <svg width="96" height="96" viewBox="0 0 100 100" className="flex-shrink-0">
          {breakdown.map((item) => {
            const pct = item.count / total;
            const dashLen = pct * circumference;
            const dashGap = circumference - dashLen;
            const currentOffset = offset;
            offset += dashLen;

            return (
              <circle
                key={item.category}
                cx="50" cy="50" r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="14"
                strokeDasharray={`${dashLen} ${dashGap}`}
                strokeDashoffset={-currentOffset}
                strokeLinecap="butt"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            );
          })}
          <text x="50" y="48" textAnchor="middle" fill="#e4e4e7" fontSize="18" fontWeight="800">
            {total}
          </text>
          <text x="50" y="62" textAnchor="middle" fill="#71717a" fontSize="9">
            risks
          </text>
        </svg>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {breakdown.map((item) => (
            <div key={item.category} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-zinc-400">{item.category}</span>
              </div>
              <span className="text-xs text-zinc-500 tabular-nums">{item.count} ({item.pct}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

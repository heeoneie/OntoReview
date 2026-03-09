import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, ShieldAlert, Search, Scale, CheckCircle2, Radio } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const EVENT_CONFIG = {
  scan_started:       { icon: Radio,         accent: 'text-sky-400',    border: 'border-sky-500/30',  bg: 'bg-sky-950/20',    badge: 'bg-sky-500/20 text-sky-300 ring-sky-500/30' },
  review_classified:  { icon: FileText,      accent: 'text-zinc-400',   border: 'border-zinc-700/50', bg: 'bg-zinc-800/30',   badge: 'bg-zinc-700/30 text-zinc-400 ring-zinc-600/30' },
  precedent_matched:  { icon: Scale,         accent: 'text-amber-400',  border: 'border-amber-500/30',bg: 'bg-amber-950/20',  badge: 'bg-amber-500/20 text-amber-300 ring-amber-500/30' },
  risk_flagged:       { icon: ShieldAlert,   accent: 'text-red-400',    border: 'border-red-500/40',  bg: 'bg-red-950/20',    badge: 'bg-red-500/20 text-red-300 ring-red-500/30' },
  scan_completed:     { icon: CheckCircle2,  accent: 'text-emerald-400',border: 'border-emerald-500/30',bg:'bg-emerald-950/20',badge: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30' },
};

const EVENT_LABELS = {
  ko: {
    scan_started: 'SCAN STARTED', review_classified: 'CLASSIFIED',
    precedent_matched: 'PRECEDENT MATCHED', risk_flagged: 'RISK FLAGGED',
    scan_completed: 'SCAN COMPLETED',
  },
  en: {
    scan_started: 'SCAN STARTED', review_classified: 'CLASSIFIED',
    precedent_matched: 'PRECEDENT MATCHED', risk_flagged: 'RISK FLAGGED',
    scan_completed: 'SCAN COMPLETED',
  },
};

function formatTimestamp(iso) {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function SeverityDot({ severity }) {
  if (severity == null) return null;
  const s = Number(severity);
  const color = s >= 9 ? 'bg-red-500 shadow-red-500/60' : s >= 7 ? 'bg-orange-400 shadow-orange-400/50' : s >= 4 ? 'bg-amber-400 shadow-amber-400/40' : 'bg-zinc-500';
  return (
    <span className={`inline-block w-2 h-2 rounded-full shadow-[0_0_6px] ${color}`} title={`Severity: ${s}`} />
  );
}

export default function AuditTimeline() {
  const { lang } = useLang();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/audit/events`, { params: { limit: 50 } });
      setEvents(data);
    } catch {
      // silent — keep last data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    intervalRef.current = setInterval(fetchEvents, 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetchEvents]);

  const labels = EVENT_LABELS[lang] || EVENT_LABELS.en;

  const filtered = filter
    ? events.filter((e) => e.event_type === filter)
    : events;

  // Group by scan_id for visual grouping
  const scanIds = [...new Set(events.map((e) => e.scan_id).filter(Boolean))];
  const eventCounts = {};
  for (const e of events) {
    eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
  }

  const title = lang === 'ko' ? 'Audit Trail' : 'Audit Trail';
  const subtitle = lang === 'ko'
    ? `${scanIds.length}개 스캔 · ${events.length}건 기록`
    : `${scanIds.length} scans · ${events.length} events`;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-zinc-800/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Search className="text-zinc-400" size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
            <p className="text-[11px] text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[10px] text-emerald-400 font-bold tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-6 py-2.5 border-b border-zinc-800/50 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setFilter('')}
          className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide transition-colors ${
            !filter
              ? 'bg-white/10 text-white ring-1 ring-white/20'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          ALL ({events.length})
        </button>
        {Object.entries(EVENT_CONFIG).map(([type, cfg]) => {
          const count = eventCounts[type] || 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? '' : type)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide transition-colors whitespace-nowrap ${
                filter === type
                  ? `${cfg.badge} ring-1`
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {labels[type]} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading && events.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-600 text-xs">
            {lang === 'ko' ? '로딩 중...' : 'Loading...'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-600 text-xs">
            {lang === 'ko' ? '기록된 이벤트가 없습니다' : 'No audit events recorded'}
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-zinc-900 border-b border-zinc-800">
                <th className="text-left text-zinc-600 font-medium px-6 py-2 uppercase tracking-wider">Time</th>
                <th className="text-left text-zinc-600 font-medium px-3 py-2 uppercase tracking-wider">Scan ID</th>
                <th className="text-left text-zinc-600 font-medium px-3 py-2 uppercase tracking-wider">Event</th>
                <th className="text-left text-zinc-600 font-medium px-3 py-2 uppercase tracking-wider">Risk</th>
                <th className="text-left text-zinc-600 font-medium px-3 py-2 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evt) => {
                const cfg = EVENT_CONFIG[evt.event_type] || EVENT_CONFIG.review_classified;
                const Icon = cfg.icon;
                const details = evt.details || {};
                const severity = details.severity;
                const isRisk = evt.event_type === 'risk_flagged';

                return (
                  <tr
                    key={evt.id}
                    className={`border-b transition-colors ${cfg.border} ${cfg.bg} hover:bg-zinc-800/50`}
                  >
                    {/* Time */}
                    <td className="px-6 py-2.5 whitespace-nowrap">
                      <div className="text-zinc-400 font-mono">{formatTimestamp(evt.timestamp)}</div>
                      <div className="text-zinc-600 font-mono text-[9px]">{formatDate(evt.timestamp)}</div>
                    </td>

                    {/* Scan ID */}
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-zinc-500">{evt.scan_id ? evt.scan_id.slice(0, 8) : '—'}</span>
                    </td>

                    {/* Event type badge */}
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded ring-1 text-[10px] font-bold tracking-wide ${cfg.badge}`}>
                        <Icon size={10} />
                        {labels[evt.event_type] || evt.event_type}
                      </span>
                    </td>

                    {/* Risk category */}
                    <td className="px-3 py-2.5">
                      {(evt.risk_category || details.risk_category) ? (
                        <span className="inline-flex items-center gap-1.5">
                          {isRisk && <SeverityDot severity={severity} />}
                          <span className={isRisk ? 'text-red-300 font-medium' : 'text-zinc-400'}>
                            {evt.risk_category || details.risk_category}
                          </span>
                          {isRisk && severity != null && (
                            <span className="text-red-400/80 font-mono font-bold">{Number(severity).toFixed(1)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Details */}
                    <td className="px-3 py-2.5 max-w-[280px]">
                      <DetailsCell details={details} eventType={evt.event_type} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DetailsCell({ details, eventType }) {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-zinc-700">—</span>;
  }

  if (eventType === 'precedent_matched') {
    return (
      <div className="flex flex-col gap-0.5">
        {details.case_name && (
          <span className="text-amber-300/90 font-medium truncate">{details.case_name}</span>
        )}
        {details.expected_exposure_usd != null && (
          <span className="text-amber-400/70 font-mono text-[10px]">
            ${Number(details.expected_exposure_usd).toLocaleString()}
          </span>
        )}
      </div>
    );
  }

  if (eventType === 'scan_started' || eventType === 'scan_completed') {
    const parts = [];
    if (details.review_count != null) parts.push(`${details.review_count} reviews`);
    if (details.reviews_ingested != null) parts.push(`${details.reviews_ingested} ingested`);
    if (details.risks_detected != null) parts.push(`${details.risks_detected} risks`);
    return <span className="text-zinc-400">{parts.join(' · ') || '—'}</span>;
  }

  if (details.title) {
    return <span className="text-zinc-400 truncate block">{details.title}</span>;
  }

  return <span className="text-zinc-600 font-mono truncate block">{JSON.stringify(details)}</span>;
}

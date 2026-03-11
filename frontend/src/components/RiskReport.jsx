import { useRef, useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useLang } from '../contexts/LangContext';

/* ── Reasoning helpers (same logic as ReasoningChain.jsx) ── */
const REGULATION_MAP = {
  ProductLiability: 'FDA Cosmetic Safety Act (21 CFR 740)',
  ClassAction: 'Consumer Product Safety Act',
  ConsumerFraud: 'FTC Act Section 5',
};

function classifyItem(item) {
  const cid = item.case_id || '';
  if (cid.startsWith('PL-')) return 'ProductLiability';
  if (cid.startsWith('CA-')) return 'ClassAction';
  if (cid.startsWith('FA-')) return 'ConsumerFraud';
  return 'RiskEvent';
}

/* ── Inline styles for PDF (avoids oklch / Tailwind issues) ── */
const S = {
  page: { width: 794, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827', background: '#ffffff', fontSize: 12, lineHeight: 1.5 },
  px: { padding: '32px 40px' },
  sectionTitle: { fontSize: 10, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 },
  hr: { borderTop: '2px solid #111827', margin: 0 },
  hrLight: { borderTop: '1px solid #e5e7eb', margin: 0 },
  tableHeader: { fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px 8px 0', textAlign: 'left', borderBottom: '2px solid #d1d5db' },
  tableHeaderRight: { fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 0 8px 12px', textAlign: 'right', borderBottom: '2px solid #d1d5db' },
  td: { padding: '6px 12px 6px 0', fontSize: 11, color: '#374151', borderBottom: '1px solid #f3f4f6' },
  tdRight: { padding: '6px 0 6px 12px', fontSize: 11, color: '#374151', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #f3f4f6' },
  tdMono: { padding: '6px 12px 6px 0', fontSize: 11, color: '#6b7280', fontFamily: 'monospace', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' },
  empty: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic' },
};

export default function RiskReport({ kpi, timeline, auditEvents, amazonUrl, scanId, discoveryResults }) {
  const { t } = useLang();
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState('');

  const generateRiskReport = useCallback(async () => {
    const el = reportRef.current;
    if (!el) return;

    const generatedAtText = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
    flushSync(() => {
      setGenerating(true);
      setGeneratedAt(generatedAtText);
    });

    try {
      el.style.display = 'block';
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.style.zIndex = '-9999';
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);

      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: el.scrollHeight,
        skipFonts: true,
      });

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const imgWidth = 210;
      const imgHeight = (img.height * imgWidth) / img.width;
      // eslint-disable-next-line new-cap
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yOffset = 0;
      const pageHeight = 297;

      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, -yOffset, imgWidth, imgHeight);
        yOffset += pageHeight;
      }

      pdf.save(`OntoReview_Risk_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      el.style.display = 'none';
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      el.style.zIndex = '';
      setGenerating(false);
    }
  }, []);

  /* ── Data prep ── */
  const exposure = kpi?.total_legal_exposure_usd || 0;
  const exposureFormatted = `$${exposure.toLocaleString()}`;
  const topRisks = (timeline || []).slice(0, 10);

  const filteredEvents = scanId
    ? (auditEvents || []).filter((e) => e.scan_id === scanId)
    : (auditEvents || []);

  const precedentMatches = filteredEvents
    .filter((e) => e.event_type === 'precedent_matched' && e.details)
    .slice(0, 8);

  const auditTrail = filteredEvents.slice(0, 15);

  // Reasoning chain
  const reasoningItem = (timeline || []).find((i) => i.severity >= 7) || (timeline || [])[0];
  const owlClass = reasoningItem ? classifyItem(reasoningItem) : null;
  const regulation = owlClass ? (REGULATION_MAP[owlClass] || 'US Federal Regulation') : null;

  // Discovery
  const discoveries = discoveryResults?.results || [];

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={generateRiskReport}
        disabled={generating}
        className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl font-medium hover:bg-zinc-700 transition-colors text-sm flex items-center gap-1.5 border border-zinc-700 disabled:opacity-50"
      >
        {generating
          ? <><Loader2 className="animate-spin" size={14} />PDF...</>
          : <><Download size={14} />{t('risk.downloadBtn')}</>
        }
      </button>

      {/* ─── Off-screen PDF Report (ALL INLINE STYLES for reliable capture) ─── */}
      <div
        ref={reportRef}
        style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, ...S.page }}
      >
        <div style={S.px}>

          {/* ═══ COVER / HEADER ═══ */}
          <div style={{ borderBottom: '3px solid #111827', paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>
                  OntoReview
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
                  Risk Intelligence Report
                </h1>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Litigation Prevention OS — Duty of Care Compliance
                </p>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: '#6b7280', lineHeight: 1.6 }}>
                <p style={{ fontWeight: 700, color: '#b91c1c', fontSize: 11, margin: 0 }}>CONFIDENTIAL</p>
                <p style={{ margin: 0 }}>Internal Use Only</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 14, fontSize: 11, color: '#6b7280' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#374151' }}>Target: </span>
                {amazonUrl || 'N/A'}
              </div>
              <div>
                <span style={{ fontWeight: 600, color: '#374151' }}>Generated: </span>
                {generatedAt}
              </div>
              {scanId && (
                <div>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Scan ID: </span>
                  {scanId.slice(0, 12)}...
                </div>
              )}
            </div>
          </div>

          {/* ═══ 1. EXECUTIVE SUMMARY ═══ */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={S.sectionTitle}>1. Executive Summary</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              {/* Exposure card */}
              <div style={{ flex: 1, border: '1.5px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '16px 20px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Total Legal Exposure
                </p>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#b45309', margin: 0 }}>{exposureFormatted}</p>
              </div>
              {/* Risk Score */}
              <div style={{ flex: 1, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '16px 20px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Overall Risk Score
                </p>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#111827', margin: 0 }}>{kpi?.overall_risk_score || 0}</p>
              </div>
              {/* Critical Risks */}
              <div style={{ flex: 1, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '16px 20px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Critical Risks / Reviews
                </p>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#111827', margin: 0 }}>
                  {kpi?.critical_risks_detected || 0}
                  <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 500, marginLeft: 4 }}>
                    / {kpi?.total_scanned_reviews || 0}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* ═══ 2. AI REASONING PROCESS ═══ */}
          {reasoningItem && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={S.sectionTitle}>2. AI Reasoning Process</h2>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
                {[
                  { label: 'Step 1 — Signal Detection', value: reasoningItem.name },
                  { label: 'Step 2 — Risk Classification', value: `${owlClass} (Severity: ${reasoningItem.severity})` },
                  { label: 'Step 3 — Regulatory Mapping', value: regulation },
                  { label: 'Step 4 — Precedent Match', value: reasoningItem.case_id || 'Matched Legal Precedent' },
                  { label: 'Step 5 — Exposure Estimate', value: exposureFormatted, highlight: true },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', marginBottom: i < 4 ? 10 : 0 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: step.highlight ? '#f59e0b' : '#d1d5db',
                      color: step.highlight ? '#fff' : '#374151', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 12,
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {step.label}
                      </span>
                      <p style={{
                        margin: '2px 0 0', fontSize: step.highlight ? 16 : 12,
                        fontWeight: step.highlight ? 800 : 600,
                        color: step.highlight ? '#b45309' : '#111827',
                      }}>
                        {step.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ 3. DETECTED RISK SIGNALS ═══ */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={S.sectionTitle}>3. Detected Risk Signals</h2>
            {topRisks.length === 0 ? (
              <p style={S.empty}>No risk signals detected.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={S.tableHeader}>Date</th>
                    <th style={S.tableHeader}>Risk Signal</th>
                    <th style={S.tableHeader}>Category</th>
                    <th style={S.tableHeader}>Severity</th>
                    <th style={S.tableHeaderRight}>Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {topRisks.map((item, i) => {
                    const sev = item.severity || 0;
                    const sevColor = sev >= 9 ? '#92400e' : sev >= 7 ? '#b45309' : '#d97706';
                    return (
                      <tr key={item.id || i}>
                        <td style={S.tdMono}>
                          {item.detected_at ? new Date(item.detected_at).toLocaleDateString('en-CA') : '—'}
                        </td>
                        <td style={{ ...S.td, fontWeight: 600, color: '#111827' }}>{item.name || '—'}</td>
                        <td style={S.td}>{item.type || '—'}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: sevColor }}>{sev.toFixed(1)}</td>
                        <td style={S.tdRight}>
                          {typeof item.estimated_loss_usd === 'number' ? `$${item.estimated_loss_usd.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ═══ 4. LEGAL PRECEDENT MATCHES ═══ */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={S.sectionTitle}>4. Legal Precedent Matches</h2>
            {precedentMatches.length === 0 ? (
              <p style={S.empty}>No precedent matches in audit log.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={S.tableHeader}>Case Name</th>
                    <th style={S.tableHeader}>Risk Category</th>
                    <th style={S.tableHeaderRight}>Est. Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  {precedentMatches.map((evt, i) => {
                    const d = evt.details || {};
                    return (
                      <tr key={evt.id || i}>
                        <td style={{ ...S.td, fontWeight: 600, color: '#111827' }}>{d.case_title || d.case_name || '—'}</td>
                        <td style={S.td}>{d.risk_category || evt.risk_category || '—'}</td>
                        <td style={S.tdRight}>
                          {d.expected_exposure_usd != null ? `$${Number(d.expected_exposure_usd).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ═══ 5. WEB RISK DISCOVERY ═══ */}
          {discoveries.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={S.sectionTitle}>5. Web Risk Discovery</h2>
              <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 10 }}>
                Scanned {discoveryResults.total_scanned} sources — {discoveryResults.risks_found} risk signals found
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={S.tableHeader}>Source</th>
                    <th style={S.tableHeader}>Title</th>
                    <th style={S.tableHeader}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {discoveries.slice(0, 8).map((item, i) => (
                    <tr key={i}>
                      <td style={{ ...S.tdMono, fontSize: 10 }}>{item.source_domain}</td>
                      <td style={{ ...S.td, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </td>
                      <td style={{ ...S.td, fontWeight: 600, color: item.risk_detected ? '#b91c1c' : '#059669' }}>
                        {item.risk_detected ? 'DETECTED' : 'Clean'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ 6. SYSTEM AUDIT TRAIL ═══ */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={S.sectionTitle}>{discoveries.length > 0 ? '6' : '5'}. System Audit Trail (Duty of Care)</h2>
            {auditTrail.length === 0 ? (
              <p style={S.empty}>No audit events recorded.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={S.tableHeader}>Timestamp</th>
                    <th style={S.tableHeader}>Scan ID</th>
                    <th style={S.tableHeader}>Event Type</th>
                    <th style={S.tableHeader}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.map((evt, i) => {
                    const d = evt.details || {};
                    const detail = [d.case_title, d.risk_category, d.severity ? `sev: ${d.severity}` : null].filter(Boolean).join(' · ');
                    return (
                      <tr key={evt.id || i}>
                        <td style={S.tdMono}>
                          {evt.timestamp ? new Date(evt.timestamp).toLocaleString('en-CA', { hour12: false }) : '—'}
                        </td>
                        <td style={{ ...S.tdMono, fontSize: 10 }}>{evt.scan_id ? evt.scan_id.slice(0, 8) : '—'}</td>
                        <td style={{ ...S.td, fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.03em' }}>
                          {evt.event_type || '—'}
                        </td>
                        <td style={{ ...S.td, fontSize: 10, color: '#6b7280' }}>{detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ═══ FOOTER ═══ */}
          <div style={{ borderTop: '3px solid #111827', paddingTop: 16, marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 9, color: '#6b7280', margin: 0 }}>
              OntoReview v1.0 — Risk Intelligence & Compliance Audit System
            </p>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
              Confidential — Internal Risk Audit Only
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

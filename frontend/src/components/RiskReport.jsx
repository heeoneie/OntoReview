import { useRef, useCallback, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useLang } from '../contexts/LangContext';

/**
 * RiskReport — Off-screen light-theme report + PDF export via html2canvas → jsPDF.
 *
 * Props:
 *   kpi           - { total_legal_exposure_usd, critical_risks_detected, overall_risk_score, total_scanned_reviews }
 *   timeline      - Array of risk timeline items
 *   auditEvents   - Array of audit trail events
 *   amazonUrl     - Target ASIN / product URL
 */
export default function RiskReport({ kpi, timeline, auditEvents, amazonUrl }) {
  const { t } = useLang();
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const now = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  const generateRiskReport = useCallback(async () => {
    const el = reportRef.current;
    if (!el) return;

    setGenerating(true);
    try {
      // Briefly make visible for capture (still off-screen)
      el.style.display = 'block';

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,       // A4 width at 96dpi
        windowWidth: 794,
      });

      el.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // eslint-disable-next-line new-cap
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yOffset = 0;
      const pageHeight = 297; // A4 mm

      // Multi-page support
      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight);
        yOffset += pageHeight;
      }

      const filename = `OntoReview_Risk_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } finally {
      setGenerating(false);
    }
  }, []);

  // ── Data prep ──
  const topRisks = (timeline || []).slice(0, 8);

  const precedentMatches = (auditEvents || [])
    .filter((e) => e.event_type === 'precedent_matched' && e.details)
    .slice(0, 8);

  const auditTrail = (auditEvents || []).slice(0, 12);

  const exposureFormatted = `$${(kpi?.total_legal_exposure_usd || 0).toLocaleString()}`;

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

      {/* ─── Off-screen PDF Report Container (Light Theme) ─── */}
      <div
        ref={reportRef}
        style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0 }}
        className="w-[794px] bg-white text-gray-900 font-sans"
      >
        <div className="px-10 py-8">

          {/* ═══ Header ═══ */}
          <div className="border-b-2 border-gray-900 pb-5 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
                  Risk Intelligence &amp; Compliance Audit
                </h1>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                  OntoReview — Litigation Prevention OS
                </p>
              </div>
              <div className="text-right text-xs text-gray-500 leading-relaxed">
                <p className="font-bold text-gray-700">CONFIDENTIAL</p>
                <p>Internal Use Only</p>
              </div>
            </div>
            <div className="mt-4 flex gap-8 text-xs text-gray-600">
              <div>
                <span className="font-semibold text-gray-800">Target: </span>
                {amazonUrl || 'N/A'}
              </div>
              <div>
                <span className="font-semibold text-gray-800">Generated: </span>
                {now}
              </div>
            </div>
          </div>

          {/* ═══ Section 1: Executive Summary ═══ */}
          <div className="mb-8">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
              1. Executive Summary
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {/* Legal Exposure */}
              <div className="border border-red-200 bg-red-50 rounded-lg px-5 py-4">
                <p className="text-[10px] font-bold text-red-800 uppercase tracking-wide mb-1">
                  Total Legal Exposure
                </p>
                <p className="text-2xl font-black text-red-700">{exposureFormatted}</p>
              </div>
              {/* Risk Score */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg px-5 py-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Overall Risk Score
                </p>
                <p className="text-2xl font-black text-gray-900">
                  {kpi?.overall_risk_score || 0}
                </p>
              </div>
              {/* Critical Risks */}
              <div className="border border-gray-200 bg-gray-50 rounded-lg px-5 py-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Critical Risks Detected
                </p>
                <p className="text-2xl font-black text-gray-900">
                  {kpi?.critical_risks_detected || 0}
                  <span className="text-sm text-gray-400 font-medium ml-1">
                    / {kpi?.total_scanned_reviews || 0} scanned
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* ═══ Section 2: Top Risk Signals ═══ */}
          <div className="mb-8">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
              2. Top Risk Signals
            </h2>
            {topRisks.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No risk signals detected.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Time</th>
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Risk Name</th>
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Category</th>
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Severity</th>
                    <th className="text-right py-2 font-bold text-gray-600 uppercase text-[10px]">Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {topRisks.map((item, i) => {
                    const sev = item.severity || 0;
                    const sevColor = sev >= 9 ? 'text-red-700 font-black' : sev >= 7 ? 'text-orange-600 font-bold' : 'text-amber-600 font-medium';
                    return (
                      <tr key={item.id || i} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-500 font-mono whitespace-nowrap">
                          {item.detected_at ? new Date(item.detected_at).toLocaleDateString('en-CA') : '—'}
                        </td>
                        <td className="py-2 pr-3 text-gray-800 font-medium">{item.name || '—'}</td>
                        <td className="py-2 pr-3 text-gray-600">{item.type || '—'}</td>
                        <td className={`py-2 pr-3 font-mono ${sevColor}`}>{sev.toFixed(1)}</td>
                        <td className="py-2 text-right text-gray-700 font-mono">
                          {item.estimated_loss_usd ? `$${item.estimated_loss_usd.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ═══ Section 3: Legal Precedent Matches ═══ */}
          <div className="mb-8">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
              3. Legal Precedent Matches
            </h2>
            {precedentMatches.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No precedent matches in audit log.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Case Name</th>
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Risk Category</th>
                    <th className="text-right py-2 font-bold text-gray-600 uppercase text-[10px]">Est. Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  {precedentMatches.map((evt, i) => {
                    const d = evt.details || {};
                    return (
                      <tr key={evt.id || i} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-800 font-medium">{d.case_name || '—'}</td>
                        <td className="py-2 pr-3 text-gray-600">{d.risk_category || evt.risk_category || '—'}</td>
                        <td className="py-2 text-right text-gray-700 font-mono">
                          {d.expected_exposure_usd ? `$${Number(d.expected_exposure_usd).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ═══ Section 4: System Audit Trail ═══ */}
          <div className="mb-8">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
              4. System Audit Trail
            </h2>
            {auditTrail.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No audit events recorded.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Timestamp</th>
                    <th className="text-left py-2 pr-3 font-bold text-gray-600 uppercase text-[10px]">Scan ID</th>
                    <th className="text-left py-2 font-bold text-gray-600 uppercase text-[10px]">Event Type</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.map((evt, i) => (
                    <tr key={evt.id || i} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-500 font-mono whitespace-nowrap">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleString('en-CA', { hour12: false }) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-gray-500 font-mono">{evt.scan_id ? evt.scan_id.slice(0, 8) : '—'}</td>
                      <td className="py-2 text-gray-700 font-medium uppercase tracking-wide">{evt.event_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ═══ Footer ═══ */}
          <div className="border-t-2 border-gray-900 pt-4 mt-8 flex items-center justify-between">
            <p className="text-[10px] text-gray-500">
              OntoReview v1.0 — Risk Intelligence & Compliance Audit System
            </p>
            <p className="text-xs font-black text-red-700 uppercase tracking-widest">
              Confidential — Internal Risk Audit Only
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

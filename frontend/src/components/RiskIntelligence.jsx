import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, Clock, Globe, ExternalLink } from 'lucide-react';
import {
  runDemoScenario,
  getKpiSummary,
  getRiskTimeline,
  getAuditEvents,
  runFullDemo,
  getOntologyGraph,
  searchBrandRisks,
} from '../api/client';
import { useLang } from '../contexts/LangContext';
import HeroCommand from './HeroCommand';
import InvestigationWorkspace from './InvestigationWorkspace';
import ExposureHero from './ExposureHero';
import ReasoningChain from './ReasoningChain';
import RiskLoadingSpinner from './RiskLoadingSpinner';
import DataSources from './DataSources';
import GraphPreview from './GraphPreview';
import RiskBreakdown from './RiskBreakdown';

// ── Constants ──

const INDUSTRY_INPUT_CFG = {
  ecommerce: { labelKey1: 'risk.label1_ecommerce', default1: 'LANEIGE',          labelKey2: 'risk.label2_ecommerce', default2: 'Water Sleeping Mask' },
  hospital:  { labelKey1: 'risk.label1_hospital',  default1: 'MedStar Health',   labelKey2: 'risk.label2_hospital',  default2: 'Knee Replacement Surgery' },
  finance:   { labelKey1: 'risk.label1_finance',   default1: 'PayTrust',         labelKey2: 'risk.label2_finance',   default2: 'Mobile Pay App v3.0' },
  gaming:    { labelKey1: 'risk.label1_gaming',     default1: 'ChronoGames',      labelKey2: 'risk.label2_gaming',    default2: 'ChronoWar Mobile' },
};

// ── Helpers ──

function injectBrand(obj, brand) {
  if (!brand || obj == null) return obj;
  if (typeof obj === 'string') return obj.replace(/OO/g, brand);
  if (Array.isArray(obj)) return obj.map((v) => injectBrand(v, brand));
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, injectBrand(v, brand)]),
    );
  }
  return obj;
}

function getErrorMessage(err, t) {
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return t('risk.errTimeout');
  }
  return err?.response?.data?.detail || t('risk.errGeneric');
}

// ── Component ──

export default function RiskIntelligence({ onNavigatePlaybook, onComplianceData, onMeetingData }) {
  const { t, lang } = useLang();

  // Analysis state
  const [demoResult, setDemoResult] = useState(null);
  const [ontology, setOntology] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [errors, setErrors] = useState({});
  const [industry, setIndustry] = useState('ecommerce');
  const [brandName, setBrandName] = useState(INDUSTRY_INPUT_CFG.ecommerce.default1);
  const [productName, setProductName] = useState(INDUSTRY_INPUT_CFG.ecommerce.default2);
  const toastTimerRef = useRef(null);

  // Unified analysis state
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // KPI live data
  const [kpi, setKpi] = useState({
    total_scanned_reviews: 0,
    critical_risks_detected: 0,
    today_new_ingestions: 0,
    overall_risk_score: 0,
    total_legal_exposure_usd: 0,
  });
  const [scanId, setScanId] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [discoveryResults, setDiscoveryResults] = useState(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // ── Lift compliance/meeting data to parent ──

  useEffect(() => { onComplianceData?.(compliance); }, [compliance, onComplianceData]);
  useEffect(() => { onMeetingData?.(meeting); }, [meeting, onMeetingData]);

  // ── Effects ──

  const refreshDashboard = useCallback(async () => {
    try {
      const [kpiRes, tlRes, auditRes] = await Promise.all([
        getKpiSummary(), getRiskTimeline(), getAuditEvents(50),
      ]);
      const safeKpi = kpiRes.data || {};
      setKpi({
        total_scanned_reviews: Number(safeKpi.total_scanned_reviews) || 0,
        critical_risks_detected: Number(safeKpi.critical_risks_detected) || 0,
        today_new_ingestions: Number(safeKpi.today_new_ingestions) || 0,
        overall_risk_score: Number(safeKpi.overall_risk_score) || 0,
        total_legal_exposure_usd: Number(safeKpi.total_legal_exposure_usd) || 0,
      });
      setTimeline(Array.isArray(tlRes.data) ? tlRes.data : []);
      setAuditEvents(Array.isArray(auditRes.data) ? auditRes.data : []);
    } catch {
      setKpi({ total_scanned_reviews: 0, critical_risks_detected: 0, today_new_ingestions: 0, overall_risk_score: 0, total_legal_exposure_usd: 0 });
      setTimeline([]);
      setAuditEvents([]);
    }
  }, []);

  // NOTE: Do NOT auto-fetch on mount — data should only appear after user runs analysis
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── Handlers ──

  const handleIndustryChange = (id) => {
    setIndustry(id);
    const cfg = INDUSTRY_INPUT_CFG[id];
    setBrandName(cfg.default1);
    setProductName(cfg.default2);
    setDemoResult(null);
    setOntology(null);
    setCompliance(null);
    setMeeting(null);
    setErrors({});
  };

  const handleDiscoveryScan = async (brand, product) => {
    const b = brand || brandName.trim();
    if (!b || discoveryLoading) return;
    setDiscoveryLoading(true);
    try {
      const res = await searchBrandRisks(b, product || productName.trim() || null);
      setDiscoveryResults(res.data);
    } catch (err) {
      console.error('Discovery scan failed:', err);
      setDiscoveryResults({ results: [], total_scanned: 0, risks_found: 0, error: true });
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleAnalysis = async () => {
    if (analysisLoading) return;
    const brand = brandName.trim() || INDUSTRY_INPUT_CFG[industry].default1;
    const product = productName.trim() || INDUSTRY_INPUT_CFG[industry].default2;

    setAnalysisLoading(true);

    setDemoResult(null);
    setOntology(null);
    setCompliance(null);
    setMeeting(null);
    setDiscoveryResults(null);
    setErrors({});

    try {
      const [ingestRes] = await Promise.all([
        runFullDemo(),
        handleDiscoveryScan(brand, product),
      ]);
      const d = ingestRes.data;
      setScanId(d.scan_id ?? null);

      const demoRes = await runDemoScenario(industry, lang);
      const demoData = injectBrand(demoRes.data, brand);
      setDemoResult(demoData);
      if (demoData.compliance) setCompliance(demoData.compliance);
      if (demoData.meeting) setMeeting(demoData.meeting);

      if (demoData.ontology) {
        setOntology(demoData.ontology);
      } else {
        try {
          const graphRes = await getOntologyGraph(d.scan_id || 0);
          if (graphRes.data?.nodes?.length > 0) setOntology(graphRes.data);
        } catch { /* ontology graph optional */ }
      }

      await refreshDashboard();

      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      setErrors({ analysis: getErrorMessage(err, t) });
    } finally {
      setAnalysisLoading(false);
    }
  };

  // ── Computed ──

  const hasScanned = scanId || timeline.length > 0;
  const hasData = !!(demoResult || ontology || compliance || meeting || timeline.length > 0 || hasScanned);

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* 1. Hero Command */}
      <HeroCommand
        expanded={!hasData}
        industry={industry}
        onIndustryChange={handleIndustryChange}
        brandName={brandName}
        onBrandChange={setBrandName}
        brandLabel={t(INDUSTRY_INPUT_CFG[industry]?.labelKey1 ?? 'risk.label1_ecommerce')}
        productName={productName}
        onProductChange={setProductName}
        productLabel={t(INDUSTRY_INPUT_CFG[industry]?.labelKey2 ?? 'risk.label2_ecommerce')}
        onRunAnalysis={handleAnalysis}
        analysisLoading={analysisLoading}
      />

      {/* 2. Loading */}
      {analysisLoading && (
        <RiskLoadingSpinner mode="fullDemo" />
      )}

      {/* Error */}
      {errors.analysis && (
        <div className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm">
          {errors.analysis}
        </div>
      )}

      {/* 3. Exposure Hero */}
      {hasData && (
        <ExposureHero
          kpi={kpi}
          timeline={timeline}
          auditEvents={auditEvents}
          scanId={scanId}
          discoveryResults={discoveryResults}
        />
      )}

      {/* 4. Investigation Workspace (2-column) */}
      {hasData && (demoResult || timeline.length > 0 || discoveryResults || ontology) && (
        <InvestigationWorkspace
          leftCount={timeline.length + (discoveryResults?.results?.length || 0)}
          left={
            <>
              {/* AI Reasoning Chain */}
              <ReasoningChain timeline={timeline} kpi={kpi} visible={timeline.length > 0} />

              {/* Risk Timeline */}
              {timeline.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="text-zinc-400" size={15} />
                      <span className="text-sm font-semibold text-white">{t('risk.timelineTitle')}</span>
                    </div>
                    <span className="text-sm text-zinc-600 tabular-nums">
                      {lang === 'ko' ? `${timeline.length}건 탐지` : `${timeline.length} detections`}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto">
                    {timeline.map((item) => {
                      const sev = item.severity >= 9 ? 'critical' : item.severity >= 7 ? 'high' : 'medium';
                      const dotColor = sev === 'critical' ? 'bg-white' : sev === 'high' ? 'bg-zinc-400' : 'bg-zinc-600';
                      const badgeStyle = sev === 'critical'
                        ? 'bg-zinc-700 text-white'
                        : sev === 'high'
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-zinc-800 text-zinc-400';

                      return (
                        <div key={item.id} className="group flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 transition-colors">
                          <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-zinc-500">{item.source}</span>
                              {item.case_id && (
                                <span className="text-sm text-zinc-600 font-mono">{item.case_id}</span>
                              )}
                            </div>
                          </div>
                          <span className={`text-sm font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${badgeStyle}`}>
                            {item.severity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Web Discovery */}
              {(discoveryResults || discoveryLoading) && (
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Globe className="text-zinc-400" size={15} />
                      <span className="text-sm font-semibold text-white">{t('discovery.title')}</span>
                      {discoveryResults && (
                        <span className="text-sm text-zinc-500 ml-1">
                          {t('discovery.result')
                            .replace('{count}', discoveryResults.total_scanned)
                            .replace('{risks}', discoveryResults.risks_found)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDiscoveryScan()}
                      disabled={discoveryLoading || !brandName.trim()}
                      className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    >
                      {discoveryLoading
                        ? <><Loader2 className="animate-spin" size={12} />{t('discovery.scanning')}</>
                        : <><Globe size={12} />{t('discovery.scan')}</>}
                    </button>
                  </div>

                  {discoveryLoading && (
                    <div className="flex items-center justify-center py-8 gap-2 text-zinc-500 text-sm">
                      <Loader2 className="animate-spin text-zinc-400" size={18} />
                      {t('discovery.scanning')}
                    </div>
                  )}

                  {discoveryResults && discoveryResults.results.length > 0 && (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {discoveryResults.results.map((item) => (
                        <div key={item.url} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 transition-colors">
                          <AlertTriangle className="text-white flex-shrink-0 mt-0.5" size={14} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
                            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{item.snippet}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-400">
                                <Globe size={9} />
                                {item.source_domain}
                              </span>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
                              >
                                <ExternalLink size={9} />
                                {t('discovery.source')}
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {discoveryResults && discoveryResults.results.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-6">
                      {discoveryResults.error ? t('risk.errGeneric') : t('discovery.empty')}
                    </p>
                  )}
                </div>
              )}
            </>
          }
          contextPanel={
            <>
              {hasScanned && (
                <DataSources kpi={kpi} discoveryResults={discoveryResults} hasScanned={hasScanned} />
              )}
              <GraphPreview
                ontology={ontology}
                timeline={timeline}
                kpi={kpi}
                onNavigatePlaybook={onNavigatePlaybook ? (nodeName) => onNavigatePlaybook(nodeName, industry) : undefined}
              />
              {timeline.length > 0 && (
                <RiskBreakdown timeline={timeline} />
              )}
            </>
          }
        />
      )}

    </div>
  );
}

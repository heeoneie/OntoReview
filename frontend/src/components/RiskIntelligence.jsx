import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { Loader2, ScanSearch, AlertTriangle, Clock, Globe, ExternalLink } from 'lucide-react';
import {
  generateOntology,
  generateComplianceReport,
  generateMeetingAgenda,
  runDemoScenario,
  analyzeYouTube,
  getKpiSummary,
  getRiskTimeline,
  ingestAmazon,
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
const DevModelQuality = import.meta.env.DEV ? lazy(() => import('./ModelQuality')) : null;

// ── Constants ──

const INDUSTRY_INPUT_CFG = {
  ecommerce: { labelKey1: 'risk.label1_ecommerce', default1: '넥서스',       labelKey2: 'risk.label2_ecommerce', default2: '파워 충전기 65W' },
  hospital:  { labelKey1: 'risk.label1_hospital',  default1: '한빛의료재단', labelKey2: 'risk.label2_hospital',  default2: '무릎 인공관절 수술' },
  finance:   { labelKey1: 'risk.label1_finance',   default1: '페이트러스트', labelKey2: 'risk.label2_finance',   default2: '간편결제 앱 v3.0' },
  gaming:    { labelKey1: 'risk.label1_gaming',     default1: '크로노게임즈', labelKey2: 'risk.label2_gaming',    default2: '크로노워 모바일' },
};

// ── Helpers ──

function injectBrand(obj, brand) {
  if (!brand || !obj) return obj;
  return JSON.parse(JSON.stringify(obj).replace(/OO/g, brand));
}

function getErrorMessage(err, t) {
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return t('risk.errTimeout');
  }
  return err?.response?.data?.detail || t('risk.errGeneric');
}

// ── Component ──

export default function RiskIntelligence({ analysisResult, onNavigatePlaybook, onComplianceData, onMeetingData }) {
  const { t, lang } = useLang();

  // Analysis state
  const [demoResult, setDemoResult] = useState(null);
  const [ontology, setOntology] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState({ demo: false, all: false, ontology: false, compliance: false, meeting: false });
  const [errors, setErrors] = useState({});
  const [industry, setIndustry] = useState('ecommerce');
  const [brandName, setBrandName] = useState(INDUSTRY_INPUT_CFG.ecommerce.default1);
  const [productName, setProductName] = useState(INDUSTRY_INPUT_CFG.ecommerce.default2);
  const [scanPhase, setScanPhase] = useState(false);
  const [dataSource, setDataSource] = useState(null);
  const toastTimerRef = useRef(null);

  // KPI live data
  const [kpi, setKpi] = useState({
    total_scanned_reviews: 0,
    critical_risks_detected: 0,
    today_new_ingestions: 0,
    overall_risk_score: 0,
    total_legal_exposure_usd: 0,
  });
  const [amazonUrl, setAmazonUrl] = useState('');
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [amazonToast, setAmazonToast] = useState('');
  const [amazonToastType, setAmazonToastType] = useState('success');
  const [scanId, setScanId] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [fullDemoLoading, setFullDemoLoading] = useState(false);
  const [fullDemoStep, setFullDemoStep] = useState('');
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

  const fetchOntologyGraph = useCallback(async () => {
    try {
      const res = await getOntologyGraph(0);
      if (res.data?.nodes?.length > 0) setOntology(res.data);
    } catch (err) { console.debug('Ontology graph fetch failed:', err); }
  }, []);

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
    setDataSource(null);
    setErrors({});
  };

  const handleAmazonIngest = async () => {
    if (!amazonUrl.trim() || amazonLoading) return;
    setAmazonLoading(true);
    setAmazonToast('');
    try {
      const res = await ingestAmazon(amazonUrl.trim());
      const d = res.data;
      setScanId(d.scan_id ?? null);
      setAmazonToastType('success');
      setAmazonToast(lang === 'ko'
        ? `${d.reviews_ingested}건의 리뷰를 수집하고 ${d.risks_detected}건의 리스크를 탐지했습니다.`
        : `Ingested ${d.reviews_ingested} reviews and detected ${d.risks_detected} risks.`);
      setAmazonUrl('');
      await refreshDashboard();
    } catch (err) {
      setAmazonToastType('error');
      setAmazonToast(getErrorMessage(err, t));
    } finally {
      setAmazonLoading(false);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setAmazonToast(''), 4000);
    }
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

  const handleFullDemo = async () => {
    if (fullDemoLoading) return;
    setFullDemoLoading(true);
    setDemoResult(null);
    setOntology(null);
    setCompliance(null);
    setMeeting(null);
    setDataSource(null);
    setErrors({});
    try {
      setFullDemoStep(t('risk.fullDemoStep1'));
      const res = await runFullDemo();
      const d = res.data;
      setScanId(d.scan_id ?? null);

      setFullDemoStep(t('risk.fullDemoStep2'));
      const demoRes = await runDemoScenario(industry, lang);
      const demoData = injectBrand(demoRes.data, brandName.trim() || 'K-Brand');
      setDemoResult(demoData);
      if (demoData.ontology) setOntology(demoData.ontology);
      if (demoData.compliance) setCompliance(demoData.compliance);
      if (demoData.meeting) setMeeting(demoData.meeting);
      setDataSource('mock');

      setFullDemoStep(t('risk.fullDemoStep3'));
      await refreshDashboard();

      setFullDemoStep(t('risk.fullDemoStep4'));
      await handleDiscoveryScan(brandName.trim() || 'K-Brand', productName.trim() || null);

      setFullDemoStep(t('risk.fullDemoStep5'));
      setAmazonToastType('success');
      setAmazonToast(lang === 'ko'
        ? `Full Demo 완료 — ${d.reviews_ingested}건 수집, ${d.risks_detected}건 리스크 탐지`
        : `Full Demo complete — ${d.reviews_ingested} reviews, ${d.risks_detected} risks detected`);
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      setAmazonToastType('error');
      setAmazonToast(getErrorMessage(err, t));
    } finally {
      setFullDemoLoading(false);
      setFullDemoStep('');
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setAmazonToast(''), 5000);
    }
  };

  const handleDemo = async () => {
    const brand = [brandName.trim(), productName.trim()].filter(Boolean).join(' ') || 'OO';
    const query = [brandName.trim(), productName.trim()].filter(Boolean).join(' ');
    setScanPhase(true);
    setErrors({});
    setDemoResult(null);
    setOntology(null);
    setCompliance(null);
    setMeeting(null);
    setDataSource(null);
    await new Promise((r) => setTimeout(r, 1500));
    setScanPhase(false);
    setLoading((prev) => ({ ...prev, demo: true }));
    try {
      let data = null;
      try {
        const ytRes = await analyzeYouTube(query || brand, brandName.trim() || 'Brand', { industry, lang });
        data = ytRes.data;
        setDataSource('youtube');
      } catch {
        const res = await runDemoScenario(industry, lang);
        data = injectBrand(res.data, brand);
        setDataSource('mock');
      }
      setDemoResult(data);
      if (data.ontology) setOntology(data.ontology);
      if (data.compliance) setCompliance(data.compliance);
      if (data.meeting) setMeeting(data.meeting);
    } catch (err) {
      setErrors({ demo: getErrorMessage(err, t) });
    } finally {
      setLoading((prev) => ({ ...prev, demo: false }));
    }
  };

  const analysisData = {
    top_issues: analysisResult?.top_issues || [],
    emerging_issues: analysisResult?.emerging_issues || [],
    recommendations: analysisResult?.recommendations || [],
    all_categories: analysisResult?.all_categories || {},
    stats: analysisResult?.stats || {},
    industry,
    lang,
  };

  const runSingle = async (type) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: null }));
    try {
      if (type === 'ontology') { const res = await generateOntology(analysisData); setOntology(res.data); }
      else if (type === 'compliance') { const res = await generateComplianceReport(analysisData); setCompliance(res.data); }
      else if (type === 'meeting') { const res = await generateMeetingAgenda(analysisData); setMeeting(res.data); }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [type]: getErrorMessage(err, t) }));
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  // ── Computed ──

  const isAnyLoading = Object.values(loading).some(Boolean) || fullDemoLoading || discoveryLoading;
  const hasScanned = scanId || timeline.length > 0;
  const hasData = !!(demoResult || ontology || compliance || meeting || timeline.length > 0 || hasScanned);

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* ═══ 1. Hero Command ═══ */}
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
        amazonUrl={amazonUrl}
        onAmazonUrlChange={setAmazonUrl}
        onRunFullDemo={handleFullDemo}
        onAmazonIngest={handleAmazonIngest}
        onBrandSearch={handleDemo}
        fullDemoLoading={fullDemoLoading}
        amazonLoading={amazonLoading}
        brandSearchLoading={scanPhase || loading.demo}
        amazonToast={amazonToast}
        amazonToastType={amazonToastType}
      />

      {/* ═══ 2. Loading States ═══ */}
      {(loading.demo || loading.all) && (
        <RiskLoadingSpinner mode={loading.demo ? 'demo' : 'all'} />
      )}
      {fullDemoLoading && (
        <RiskLoadingSpinner mode="fullDemo" />
      )}

      {/* Scan phase animation */}
      {scanPhase && (
        <div className="bg-zinc-900 rounded-2xl border border-sky-900/50 p-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-sky-950 border border-sky-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <ScanSearch className="text-sky-400 animate-pulse" size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{t('risk.scanPhaseTitle')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              <span className="text-sky-400 font-medium">
                {[brandName, productName].filter(Boolean).join(' ')}
              </span>
              {t('risk.scanPhaseHint')}
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {errors.demo && (
        <div className="bg-amber-950/50 border border-amber-800/60 text-amber-400 rounded-xl px-4 py-3 text-sm">
          {errors.demo}
        </div>
      )}

      {/* ═══ 3. Exposure Hero (replaces KPI Strip) ═══ */}
      {hasData && (
        <ExposureHero
          kpi={kpi}
          timeline={timeline}
          auditEvents={auditEvents}
          amazonUrl={amazonUrl}
          scanId={scanId}
          discoveryResults={discoveryResults}
        />
      )}

      {/* ═══ 4. Investigation Workspace (2-column) ═══ */}
      {hasData && (demoResult || timeline.length > 0 || discoveryResults || ontology) && (
        <InvestigationWorkspace
          leftCount={timeline.length + (discoveryResults?.results?.length || 0)}
          left={
            <>
              {/* AI Reasoning Chain — TOP of evidence feed */}
              <ReasoningChain timeline={timeline} kpi={kpi} visible={timeline.length > 0} />

              {/* Risk Timeline */}
              {timeline.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="text-amber-400" size={15} />
                      <span className="text-sm font-semibold text-white">{t('risk.timelineTitle')}</span>
                    </div>
                    <span className="text-xs text-zinc-600 tabular-nums">
                      {lang === 'ko' ? `${timeline.length}건 탐지` : `${timeline.length} detections`}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto">
                    {timeline.map((item) => {
                      const sev = item.severity >= 9 ? 'critical' : item.severity >= 7 ? 'high' : 'medium';
                      const dotColor = sev === 'critical' ? 'bg-amber-400' : sev === 'high' ? 'bg-amber-500' : 'bg-zinc-500';
                      const badgeStyle = sev === 'critical'
                        ? 'bg-amber-500/15 text-amber-300'
                        : sev === 'high'
                          ? 'bg-amber-400/10 text-amber-400'
                          : 'bg-zinc-700 text-zinc-400';

                      return (
                        <div key={item.id} className="group flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 transition-colors">
                          <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-zinc-500">{item.source}</span>
                              {item.case_id && (
                                <span className="text-[11px] text-zinc-600 font-mono">{item.case_id}</span>
                              )}
                            </div>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${badgeStyle}`}>
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
                      <Globe className="text-cyan-400" size={15} />
                      <span className="text-sm font-semibold text-white">{t('discovery.title')}</span>
                      {discoveryResults && (
                        <span className="text-xs text-zinc-500 ml-1">
                          {t('discovery.result')
                            .replace('{count}', discoveryResults.total_scanned)
                            .replace('{risks}', discoveryResults.risks_found)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDiscoveryScan()}
                      disabled={discoveryLoading || !brandName.trim()}
                      className="px-3 py-1.5 bg-cyan-900/40 text-cyan-300 rounded-lg text-xs font-medium border border-cyan-800/60 hover:bg-cyan-900/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    >
                      {discoveryLoading
                        ? <><Loader2 className="animate-spin" size={12} />{t('discovery.scanning')}</>
                        : <><Globe size={12} />{t('discovery.scan')}</>}
                    </button>
                  </div>

                  {discoveryLoading && (
                    <div className="flex items-center justify-center py-8 gap-2 text-zinc-500 text-sm">
                      <Loader2 className="animate-spin text-cyan-400" size={18} />
                      {t('discovery.scanning')}
                    </div>
                  )}

                  {discoveryResults && discoveryResults.results.length > 0 && (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {discoveryResults.results.map((item) => (
                        <div key={item.url} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 transition-colors">
                          <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={14} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.snippet}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-medium text-zinc-400">
                                <Globe size={9} />
                                {item.source_domain}
                              </span>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
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
                loading={loading.ontology}
                onNavigatePlaybook={onNavigatePlaybook ? (nodeName) => onNavigatePlaybook(nodeName, industry) : undefined}
              />
              {timeline.length > 0 && (
                <RiskBreakdown timeline={timeline} />
              )}
            </>
          }
        />
      )}

      {/* Dev-only model quality panel */}
      {import.meta.env.DEV && DevModelQuality && (
        <Suspense fallback={null}>
          <DevModelQuality />
        </Suspense>
      )}
    </div>
  );
}

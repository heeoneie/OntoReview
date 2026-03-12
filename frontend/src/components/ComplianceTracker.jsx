import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Shield, AlertTriangle, Check, Loader2,
  ChevronRight, Scale, FileText,
} from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { getRegulations, runComplianceCheck } from '../api/client';

const JURISDICTIONS = [
  { code: 'US', flag: '\u{1F1FA}\u{1F1F8}', label: 'United States' },
  { code: 'EU', flag: '\u{1F1EA}\u{1F1FA}', label: 'European Union' },
  { code: 'KR', flag: '\u{1F1F0}\u{1F1F7}', label: 'South Korea' },
];

const RISK_CATEGORIES = [
  'Product Liability', 'Regulatory Risk', 'False Advertising',
  'Consumer Safety', 'Class Action Risk',
];

const CATEGORY_COLORS = {
  'cosmetics/food': 'bg-zinc-800 text-zinc-300 border-zinc-700',
  cosmetics: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  food: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  general: 'bg-zinc-800 text-zinc-300 border-zinc-700',
};

function violationBadge(level) {
  if (level === 'high') return 'bg-zinc-800 text-white border-zinc-600';
  if (level === 'medium') return 'bg-zinc-800 text-zinc-300 border-zinc-700';
  return 'bg-zinc-800 text-zinc-400 border-zinc-700';
}

function scoreColor(pct) {
  return 'text-white';
}

function scoreBarColor(pct) {
  if (pct >= 80) return 'bg-white';
  if (pct >= 60) return 'bg-zinc-400';
  return 'bg-zinc-500';
}

export default function ComplianceTracker() {
  const { t } = useLang();

  const [activeJur, setActiveJur] = useState('US');
  const [regulations, setRegulations] = useState({});
  const [loading, setLoading] = useState(true);

  // Check form
  const [checkCategory, setCheckCategory] = useState('Product Liability');
  const [checkDescription, setCheckDescription] = useState('');
  const [checkSeverity, setCheckSeverity] = useState(7);
  const [checkKeywords, setCheckKeywords] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      const result = {};
      for (const jur of JURISDICTIONS) {
        try {
          const res = await getRegulations(jur.code);
          result[jur.code] = res.data.regulations || [];
        } catch {
          result[jur.code] = [];
        }
      }
      setRegulations(result);
      setLoading(false);
    };
    loadAll();
  }, []);

  const handleCheck = async () => {
    if (!checkDescription.trim() && !checkKeywords.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await runComplianceCheck({
        category: checkCategory,
        description: checkDescription,
        severity: checkSeverity,
        keywords: checkKeywords,
        jurisdictions: JURISDICTIONS.map((j) => j.code),
      });
      setCheckResult(res.data);
    } catch {
      showToast('Compliance check failed');
    } finally {
      setChecking(false);
    }
  };

  const activeRegs = regulations[activeJur] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-zinc-400" />
          {t('complianceTracker.title')}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {t('complianceTracker.subtitle')}
        </p>
      </div>

      {/* Jurisdiction tabs */}
      <div className="flex gap-2">
        {JURISDICTIONS.map(({ code, flag, label }) => (
          <button
            key={code}
            onClick={() => setActiveJur(code)}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
              activeJur === code
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-600'
            }`}
          >
            <span className="text-lg">{flag}</span>
            <span>{label}</span>
            <span className="text-sm text-zinc-600 ml-1">
              ({(regulations[code] || []).length})
            </span>
          </button>
        ))}
      </div>

      {/* Regulations list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Scale className="w-4 h-4 text-zinc-400" />
          {t('complianceTracker.regulations')}
          <span className="text-sm text-zinc-500">
            — {JURISDICTIONS.find((j) => j.code === activeJur)?.label}
          </span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeRegs.map((reg) => (
              <div
                key={reg.id}
                className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg hover:border-zinc-600/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-medium text-zinc-200 leading-tight">
                    {reg.name}
                  </h3>
                  <span className={`text-sm px-2 py-0.5 rounded border flex-shrink-0 ${
                    CATEGORY_COLORS[reg.category] || CATEGORY_COLORS.general
                  }`}>
                    {reg.category}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed mb-2">
                  {reg.description}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-600">
                    {t('complianceTracker.severityWeight')}: {reg.severity_weight}/10
                  </span>
                  <div className="w-12 h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${(reg.severity_weight / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Check Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-zinc-400" />
          {t('complianceTracker.runCheck')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              {t('complianceTracker.riskCategory')}
            </label>
            <select
              value={checkCategory}
              onChange={(e) => setCheckCategory(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
            >
              {RISK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              {t('complianceTracker.severity')}: {checkSeverity}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={checkSeverity}
              onChange={(e) => setCheckSeverity(parseInt(e.target.value, 10))}
              className="w-full accent-zinc-400 mt-2"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              {t('complianceTracker.keywords')}
            </label>
            <input
              type="text"
              value={checkKeywords}
              onChange={(e) => setCheckKeywords(e.target.value)}
              placeholder="burn, rash, recall..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              {t('complianceTracker.riskDescription')}
            </label>
            <input
              type="text"
              value={checkDescription}
              onChange={(e) => setCheckDescription(e.target.value)}
              placeholder="Chemical burn reported..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
            />
          </div>
        </div>

        <button
          onClick={handleCheck}
          disabled={checking || (!checkDescription.trim() && !checkKeywords.trim())}
          className="px-5 py-2 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {checking ? t('complianceTracker.running') : t('complianceTracker.runCheck')}
        </button>
      </div>

      {/* Check Results */}
      {checkResult && (
        <div className="space-y-6">
          {/* Violations */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-white" />
              {t('complianceTracker.results')}
              <span className="text-sm text-zinc-500">
                ({checkResult.violations?.length || 0} violations)
              </span>
            </h2>

            {(!checkResult.violations || checkResult.violations.length === 0) ? (
              <div className="text-center py-8">
                <Check className="w-8 h-8 mx-auto text-white mb-2" />
                <p className="text-sm text-zinc-400">
                  {t('complianceTracker.noViolations')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {checkResult.violations.map((v, i) => (
                  <div
                    key={i}
                    className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {JURISDICTIONS.find((j) => j.code === v.jurisdiction)?.flag || ''}
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-200">
                            {v.regulation_name}
                          </h3>
                          <span className="text-sm text-zinc-600">
                            {v.regulation_id} · {v.jurisdiction}
                          </span>
                        </div>
                      </div>
                      <span className={`text-sm px-2 py-0.5 rounded border font-medium ${
                        violationBadge(v.violation_level)
                      }`}>
                        {t(`complianceTracker.violation${
                          v.violation_level.charAt(0).toUpperCase() + v.violation_level.slice(1)
                        }`)}
                      </span>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <div>
                        <span className="text-sm text-zinc-500 uppercase tracking-wide">
                          {t('complianceTracker.explanation')}
                        </span>
                        <p className="text-sm text-zinc-300 mt-0.5">
                          {v.explanation}
                        </p>
                      </div>
                      {v.recommended_action && (
                        <div>
                          <span className="text-sm text-zinc-500 uppercase tracking-wide">
                            {t('complianceTracker.recommendedAction')}
                          </span>
                          <p className="text-sm text-zinc-300 mt-0.5">
                            {v.recommended_action}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compliance Score Summary */}
          {checkResult.summary && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-zinc-400" />
                {t('complianceTracker.overallScore')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {JURISDICTIONS.map(({ code, flag, label }) => {
                  const jData = checkResult.summary.jurisdictions?.[code];
                  if (!jData) return null;
                  const pct = jData.compliance_pct ?? 100;
                  return (
                    <div
                      key={code}
                      className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-center"
                    >
                      <div className="text-2xl mb-1">{flag}</div>
                      <div className="text-sm text-zinc-500 mb-2">{label}</div>
                      <div className={`text-3xl font-bold tabular-nums text-white`}>
                        {pct}%
                      </div>
                      <div className="w-full h-2 bg-zinc-700 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-sm text-zinc-600 mt-1.5">
                        {jData.violations_high > 0 && (
                          <span className="text-white mr-2">
                            {jData.violations_high} high
                          </span>
                        )}
                        {jData.violations_medium > 0 && (
                          <span className="text-zinc-400 mr-2">
                            {jData.violations_medium} med
                          </span>
                        )}
                        {jData.violations_low > 0 && (
                          <span className="text-zinc-400">
                            {jData.violations_low} low
                          </span>
                        )}
                        {jData.violations_high === 0
                          && jData.violations_medium === 0
                          && jData.violations_low === 0 && (
                          <span className="text-zinc-400">
                            {t('complianceTracker.compliant')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {checkResult.summary.overall_score != null && (
                <div className="mt-4 text-center">
                  <span className="text-sm text-zinc-500">
                    {t('complianceTracker.overallScore')}:
                  </span>
                  <span className="text-lg font-bold ml-2 text-white">
                    {checkResult.summary.overall_score}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-800 border border-zinc-700 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

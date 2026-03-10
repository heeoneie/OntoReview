import { useState, useEffect } from 'react';
import {
  Scale, Headphones, Settings2, Zap, ChevronRight,
  ShieldCheck, AlertTriangle, Bot, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { getAgentConfigs, updateAgentConfig, simulateAgent } from '../api/client';

const AGENT_META = {
  legal: {
    icon: Scale,
    gradient: 'from-violet-500/20 to-violet-900/10',
    border: 'border-violet-800/50',
    accent: 'text-violet-400',
    badge: 'bg-violet-950 text-violet-300 border-violet-800',
    ring: 'ring-violet-500/30',
  },
  cs: {
    icon: Headphones,
    gradient: 'from-sky-500/20 to-sky-900/10',
    border: 'border-sky-800/50',
    accent: 'text-sky-400',
    badge: 'bg-sky-950 text-sky-300 border-sky-800',
    ring: 'ring-sky-500/30',
  },
  operations: {
    icon: Settings2,
    gradient: 'from-amber-500/20 to-amber-900/10',
    border: 'border-amber-800/50',
    accent: 'text-amber-400',
    badge: 'bg-amber-950 text-amber-300 border-amber-800',
    ring: 'ring-amber-500/30',
  },
};

const AUTONOMY_COLORS = [
  '', 'bg-zinc-600', 'bg-sky-600', 'bg-emerald-600', 'bg-amber-500', 'bg-red-500',
];

const RISK_CATEGORIES = [
  'Product Liability', 'Regulatory Risk', 'Class Action Risk',
  'Consumer Safety', 'False Advertising',
];

function AgentCard({ config, meta, t, lang, onUpdate, onSaved }) {
  const [localConfig, setLocalConfig] = useState(config);
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [testSeverity, setTestSeverity] = useState(7);
  const [testCategory, setTestCategory] = useState('Product Liability');
  const [testReview, setTestReview] = useState('');
  const [showSim, setShowSim] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocalConfig(config); }, [config]);

  const Icon = meta.icon;
  const agentType = config.agent_type;
  const descKey = lang === 'ko' ? 'description_ko' : 'description_en';

  const handleSave = async (field, value) => {
    const updated = { ...localConfig, [field]: value };
    setLocalConfig(updated);
    setSaving(true);
    try {
      const { data } = await updateAgentConfig(agentType, { [field]: value });
      onUpdate(agentType, data);
      onSaved();
    } catch { /* keep local state */ } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data } = await simulateAgent({
        agent_type: agentType,
        severity: testSeverity,
        risk_category: testCategory,
        review_text: testReview,
        lang,
      });
      setSimResult(data);
    } catch { setSimResult({ error: true }); } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className={`bg-gradient-to-br ${meta.gradient} rounded-2xl border ${meta.border} p-6 space-y-5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-zinc-900/80 border ${meta.border}`}>
            <Icon className={meta.accent} size={22} />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">{t(`agent.${agentType}`)}</h3>
            <p className="text-zinc-500 text-xs mt-0.5">{config[descKey]}</p>
          </div>
        </div>
        {saving && <span className="text-xs text-zinc-500 animate-pulse">saving...</span>}
      </div>

      {/* Autonomy Level */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400 font-medium">{t('agent.autonomyLevel')}</span>
          <span className={`text-sm font-bold ${meta.accent}`}>Lv.{localConfig.autonomy_level}</span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((lv) => (
            <button
              key={lv}
              onClick={() => handleSave('autonomy_level', lv)}
              className={`flex-1 h-2.5 rounded-full transition-all ${
                lv <= localConfig.autonomy_level
                  ? AUTONOMY_COLORS[lv]
                  : 'bg-zinc-800'
              } ${lv === localConfig.autonomy_level ? `ring-2 ${meta.ring}` : ''}`}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-600">
          {t(`agent.autonomyDesc${localConfig.autonomy_level}`)}
        </p>
      </div>

      {/* Escalation Threshold */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400 font-medium">{t('agent.escalationThreshold')}</span>
          <span className={`text-sm font-bold ${
            localConfig.escalation_threshold >= 8 ? 'text-red-400'
              : localConfig.escalation_threshold >= 5 ? 'text-amber-400' : 'text-emerald-400'
          }`}>{localConfig.escalation_threshold}</span>
        </div>
        <input
          type="range" min="1" max="10" step="0.5"
          value={localConfig.escalation_threshold}
          onChange={(e) => setLocalConfig({ ...localConfig, escalation_threshold: parseFloat(e.target.value) })}
          onMouseUp={() => handleSave('escalation_threshold', localConfig.escalation_threshold)}
          onTouchEnd={() => handleSave('escalation_threshold', localConfig.escalation_threshold)}
          className="w-full accent-zinc-400 h-1.5"
        />
        <p className="text-xs text-zinc-600">{t('agent.escalationDesc')}</p>
      </div>

      {/* Auto Response Toggle */}
      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Bot className="text-zinc-500" size={16} />
          <span className="text-sm text-zinc-300">{t('agent.autoResponse')}</span>
        </div>
        <button
          onClick={() => handleSave('auto_response', !localConfig.auto_response)}
          className="flex items-center gap-1.5"
        >
          {localConfig.auto_response ? (
            <>
              <ToggleRight className="text-emerald-400" size={24} />
              <span className="text-xs text-emerald-400 font-medium">{t('agent.autoResponseOn')}</span>
            </>
          ) : (
            <>
              <ToggleLeft className="text-zinc-600" size={24} />
              <span className="text-xs text-zinc-600 font-medium">{t('agent.autoResponseOff')}</span>
            </>
          )}
        </button>
      </div>

      {/* Allowed Actions */}
      <div className="space-y-2">
        <span className="text-sm text-zinc-400 font-medium">{t('agent.allowedActions')}</span>
        <div className="flex flex-wrap gap-1.5">
          {localConfig.allowed_actions?.map((action) => (
            <span key={action} className={`px-2 py-0.5 rounded-md text-xs border ${meta.badge}`}>
              {action.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Simulate Section */}
      <div className="border-t border-zinc-800/50 pt-4 space-y-3">
        <button
          onClick={() => setShowSim(!showSim)}
          className={`flex items-center gap-2 text-sm font-medium ${meta.accent} hover:underline`}
        >
          <Zap size={14} />
          {t('agent.simulate')}
          <ChevronRight size={14} className={`transition-transform ${showSim ? 'rotate-90' : ''}`} />
        </button>

        {showSim && (
          <div className="space-y-3 bg-zinc-900/60 rounded-xl p-4 border border-zinc-800/50">
            {/* Severity slider */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-xs text-zinc-500">{t('agent.severityInput')}</label>
                <span className={`text-xs font-bold ${
                  testSeverity >= 8 ? 'text-red-400' : testSeverity >= 5 ? 'text-amber-400' : 'text-emerald-400'
                }`}>{testSeverity}</span>
              </div>
              <input
                type="range" min="1" max="10" step="1"
                value={testSeverity}
                onChange={(e) => setTestSeverity(parseInt(e.target.value, 10))}
                className="w-full accent-zinc-400 h-1.5"
              />
            </div>

            {/* Category select */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">{t('agent.categoryInput')}</label>
              <select
                value={testCategory}
                onChange={(e) => setTestCategory(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200"
              >
                {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Review text */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">{t('agent.reviewInput')}</label>
              <input
                type="text" value={testReview}
                onChange={(e) => setTestReview(e.target.value)}
                placeholder="This product burned my skin..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            <button
              onClick={handleSimulate}
              disabled={simLoading}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                simLoading
                  ? 'bg-zinc-700 text-zinc-500 cursor-wait'
                  : `bg-zinc-800 ${meta.accent} hover:bg-zinc-700 border ${meta.border}`
              }`}
            >
              {simLoading ? t('agent.simulating') : t('agent.simulate')}
            </button>

            {/* Simulation Result */}
            {simResult && !simResult.error && (
              <SimulationResult result={simResult} t={t} meta={meta} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SimulationResult({ result, t, meta }) {
  const isEscalate = result.decision === 'escalate';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isEscalate
        ? 'bg-red-950/30 border-red-800/50'
        : 'bg-emerald-950/30 border-emerald-800/50'
    }`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">{t('agent.simResult')}</h4>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          isEscalate
            ? 'bg-red-950 text-red-400 border-red-800'
            : 'bg-emerald-950 text-emerald-400 border-emerald-800'
        }`}>
          {isEscalate ? (
            <span className="flex items-center gap-1"><AlertTriangle size={11} /> {t('agent.escalate')}</span>
          ) : (
            <span className="flex items-center gap-1"><ShieldCheck size={11} /> {t('agent.autoHandle')}</span>
          )}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <Row label={t('agent.confidence')} value={`${Math.round((result.confidence || 0) * 100)}%`} />
        <Row label={t('agent.message')} value={result.message} />
        {result.escalation_target && (
          <Row label={t('agent.escalationTarget')} value={result.escalation_target} />
        )}
        <Row label={t('agent.resolutionTime')} value={result.estimated_resolution_time} />
        <Row label={t('agent.riskAssessment')} value={result.risk_assessment} />
        {result.actions_taken?.length > 0 && (
          <div>
            <span className="text-zinc-500">{t('agent.actionsTaken')}</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {result.actions_taken.map((a, i) => (
                <span key={i} className={`px-2 py-0.5 rounded text-xs border ${meta.badge}`}>
                  {a.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-zinc-500 shrink-0">{label}:</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

export default function AgentSetup() {
  const { t, lang } = useLang();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getAgentConfigs()
      .then(({ data }) => setConfigs(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = (agentType, updated) => {
    setConfigs((prev) => prev.map((c) => (c.agent_type === agentType ? updated : c)));
  };

  const showSaved = () => {
    setToast(t('agent.saved'));
    setTimeout(() => setToast(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-8 text-center">
        <p className="text-red-400 font-medium">{t('risk.errGeneric')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">{t('agent.title')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{t('agent.subtitle')}</p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {configs.map((config) => (
          <AgentCard
            key={config.agent_type}
            config={config}
            meta={AGENT_META[config.agent_type] || AGENT_META.legal}
            t={t}
            lang={lang}
            onUpdate={handleUpdate}
            onSaved={showSaved}
          />
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-950 text-emerald-400 border border-emerald-800 px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  Upload, FileText, Plus, Trash2, BookOpen,
  Search, Check, X, Loader2, Database,
} from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import {
  uploadDomainKnowledge, getCustomRules, addCustomRule, deleteCustomRule,
} from '../api/client';

const OWL_CLASSES = [
  'ProductLiability', 'SkinReaction', 'ChemicalBurn',
  'Ingestion', 'Choking', 'RegulatoryRisk', 'FDAViolation',
  'RecallEvent', 'ClassAction', 'ConsumerFraud', 'Counterfeit',
  'MisleadingLabel', 'FoodSafety', 'Contamination',
  'Expiration', 'Allergen',
];

const OWL_CLASS_COLORS = {
  ProductLiability: 'bg-zinc-800 text-white border-zinc-600',
  SkinReaction: 'bg-zinc-800 text-white border-zinc-600',
  ChemicalBurn: 'bg-zinc-800 text-white border-zinc-600',
  Ingestion: 'bg-zinc-800 text-white border-zinc-600',
  Choking: 'bg-zinc-800 text-white border-zinc-600',
  RegulatoryRisk: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  FDAViolation: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  RecallEvent: 'bg-zinc-800 text-white border-zinc-600',
  ClassAction: 'bg-zinc-800 text-white border-zinc-600',
  ConsumerFraud: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  Counterfeit: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  MisleadingLabel: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  FoodSafety: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  Contamination: 'bg-zinc-800 text-white border-zinc-600',
  Expiration: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  Allergen: 'bg-zinc-800 text-zinc-300 border-zinc-700',
};

function severityColor(s) {
  if (s >= 9) return 'text-white';
  if (s >= 7) return 'text-zinc-300';
  if (s >= 4) return 'text-zinc-400';
  return 'text-zinc-500';
}

function severityBar(s) {
  if (s >= 9) return 'bg-white';
  if (s >= 7) return 'bg-zinc-400';
  if (s >= 4) return 'bg-zinc-500';
  return 'bg-zinc-600';
}

export default function OntologyStudio() {
  const { t } = useLang();

  const [uploadMode, setUploadMode] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState(null);
  const [domainName, setDomainName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedRules, setExtractedRules] = useState([]);
  const [selectedExtracted, setSelectedExtracted] = useState(new Set());

  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [toast, setToast] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newOwlClass, setNewOwlClass] = useState('ProductLiability');
  const [newSeverity, setNewSeverity] = useState(5);
  const [newDomain, setNewDomain] = useState('custom');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    getCustomRules()
      .then((res) => setRules(res.data))
      .catch(() => {})
      .finally(() => setLoadingRules(false));
  }, []);

  const handleExtract = async () => {
    setExtracting(true);
    setExtractedRules([]);
    try {
      const formData = new FormData();
      if (uploadMode === 'file' && file) {
        formData.append('file', file);
      } else {
        formData.append('text_content', textContent);
      }
      formData.append('domain_name', domainName || 'custom');
      const res = await uploadDomainKnowledge(formData);
      const extracted = res.data.extracted_rules || [];
      setExtractedRules(extracted);
      setSelectedExtracted(new Set(extracted.map((_, i) => i)));
    } catch {
      showToast('Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveExtracted = async () => {
    const toSave = extractedRules.filter((_, i) => selectedExtracted.has(i));
    let savedCount = 0;
    for (const rule of toSave) {
      try {
        const res = await addCustomRule({
          domain_name: domainName || 'custom',
          keyword: rule.keyword,
          owl_class: rule.owl_class,
          severity_override: rule.severity_override || 5,
        });
        setRules((prev) => [res.data, ...prev]);
        savedCount++;
      } catch {
        // skip failures
      }
    }
    if (savedCount > 0) {
      showToast(t('studio.saved'));
      setExtractedRules([]);
      setSelectedExtracted(new Set());
    }
  };

  const handleAddRule = async () => {
    if (!newKeyword.trim()) return;
    try {
      const res = await addCustomRule({
        domain_name: newDomain || 'custom',
        keyword: newKeyword.trim(),
        owl_class: newOwlClass,
        severity_override: newSeverity,
      });
      setRules((prev) => [res.data, ...prev]);
      setNewKeyword('');
      setNewSeverity(5);
      setShowAddForm(false);
      showToast(t('studio.saved'));
    } catch {
      showToast('Failed to add rule');
    }
  };

  const handleDelete = async (ruleId) => {
    try {
      await deleteCustomRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      showToast(t('studio.deleted'));
    } catch {
      showToast('Failed to delete rule');
    }
  };

  const toggleExtractedSelection = (idx) => {
    setSelectedExtracted((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-zinc-400" />
          {t('studio.title')}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">{t('studio.subtitle')}</p>
      </div>

      {/* Upload Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-zinc-400" />
          {t('studio.uploadTitle')}
        </h2>
        <p className="text-sm text-zinc-500 mb-4">{t('studio.uploadDesc')}</p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setUploadMode('file')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              uploadMode === 'file'
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3 h-3 inline mr-1" />
            {t('studio.uploadFile')}
          </button>
          <button
            onClick={() => setUploadMode('text')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              uploadMode === 'text'
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3 h-3 inline mr-1" />
            {t('studio.pasteText')}
          </button>
        </div>

        {/* Domain name input */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-400 mb-1">
            {t('studio.domainName')}
          </label>
          <input
            type="text"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder={t('studio.domainPlaceholder')}
            className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>

        {/* File upload or text area */}
        {uploadMode === 'file' ? (
          <div className="mb-4">
            <label className="block w-full max-w-lg border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-500 transition-colors">
              <Upload className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-400">
                {file ? file.name : 'Click to upload (.txt, .md, .pdf)'}
              </p>
              <input
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        ) : (
          <div className="mb-4">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder={t('studio.textPlaceholder')}
              rows={6}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 resize-y"
            />
          </div>
        )}

        {/* Extract button */}
        <button
          onClick={handleExtract}
          disabled={extracting || (uploadMode === 'file' ? !file : !textContent.trim())}
          className="px-4 py-2 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {extracting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {extracting ? t('studio.extracting') : t('studio.extract')}
        </button>

        {/* Extracted rules preview */}
        {extractedRules.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-white mb-3">
              {t('studio.extractedRules')} ({extractedRules.length})
            </h3>
            <div className="space-y-2">
              {extractedRules.map((rule, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleExtractedSelection(idx)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedExtracted.has(idx)
                      ? 'bg-zinc-800/60 border-zinc-600'
                      : 'bg-zinc-800/50 border-zinc-700/50 opacity-60'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedExtracted.has(idx)
                      ? 'bg-white border-white'
                      : 'border-zinc-600'
                  }`}>
                    {selectedExtracted.has(idx) && <Check className="w-3 h-3 text-zinc-900" />}
                  </div>
                  <span className="text-sm text-zinc-200 font-mono min-w-[120px]">
                    {rule.keyword}
                  </span>
                  <span className={`px-2 py-0.5 text-sm rounded border ${
                    OWL_CLASS_COLORS[rule.owl_class] || 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}>
                    {rule.owl_class}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${severityBar(rule.severity_override)}`}
                        style={{ width: `${(rule.severity_override / 10) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono ${severityColor(rule.severity_override)}`}>
                      {rule.severity_override}
                    </span>
                  </div>
                  {rule.rationale && (
                    <span className="text-sm text-zinc-500 hidden lg:block max-w-[200px] truncate">
                      {rule.rationale}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveExtracted}
              disabled={selectedExtracted.size === 0}
              className="mt-4 px-4 py-2 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium rounded-lg transition-colors"
            >
              {t('studio.saveSelected')} ({selectedExtracted.size})
            </button>
          </div>
        )}

        {extractedRules.length === 0 && extracting === false && textContent.trim() && (
          <p className="mt-4 text-sm text-zinc-600">{t('studio.noResults')}</p>
        )}
      </div>

      {/* Registered Rules Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-400" />
            {t('studio.rulesTitle')}
            {rules.length > 0 && (
              <span className="text-sm text-zinc-500 ml-1">({rules.length})</span>
            )}
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1"
          >
            {showAddForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {t('studio.addRule')}
          </button>
        </div>

        {/* Manual add form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">{t('studio.keyword')}</label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="e.g., peeling"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">{t('studio.owlClass')}</label>
                <select
                  value={newOwlClass}
                  onChange={(e) => setNewOwlClass(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
                >
                  {OWL_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  {t('studio.severity')}: {newSeverity}
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(parseFloat(e.target.value))}
                  className="w-full accent-zinc-400"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">{t('studio.domain')}</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="custom"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
                />
              </div>
            </div>
            <button
              onClick={handleAddRule}
              disabled={!newKeyword.trim()}
              className="mt-3 px-4 py-1.5 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium rounded-lg transition-colors"
            >
              {t('studio.addRule')}
            </button>
          </div>
        )}

        {/* Rules table */}
        {loadingRules ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">{t('studio.rulesEmpty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sm text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 px-3 font-medium">{t('studio.keyword')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('studio.owlClass')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('studio.severity')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('studio.domain')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('studio.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-zinc-200">{rule.keyword}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 text-sm rounded border ${
                        OWL_CLASS_COLORS[rule.owl_class] || 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}>
                        {rule.owl_class}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${severityBar(rule.severity_override)}`}
                            style={{ width: `${(rule.severity_override / 10) * 100}%` }}
                          />
                        </div>
                        <span className={`text-sm font-mono ${severityColor(rule.severity_override)}`}>
                          {rule.severity_override}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{rule.domain_name}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 text-zinc-600 hover:text-white transition-colors rounded-md hover:bg-zinc-800"
                        title={t('studio.deleteConfirm')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-800 border border-zinc-700 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}

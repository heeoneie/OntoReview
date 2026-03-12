import { useCallback, useState } from 'react';
import { useLang } from './contexts/LangContext';
import ErrorBoundary from './components/ErrorBoundary';
import RiskIntelligence from './components/RiskIntelligence';
import RiskPlaybook from './components/RiskPlaybook';
import AgentSetup from './components/AgentSetup';
import OntologyStudio from './components/OntologyStudio';
import ComplianceTracker from './components/ComplianceTracker';
import ComplianceReport from './components/ComplianceReport';
import MeetingAgenda from './components/MeetingAgenda';
import AuditTimeline from './components/AuditTimeline';
import AppSidebar from './components/AppSidebar';
import TopBar from './components/TopBar';
import './index.css';

const PAGE_TITLES = {
  intelligence: { ko: '인텔리전스', en: 'Intelligence' },
  response:     { ko: '대응 전략',   en: 'Response' },
  compliance:   { ko: '컴플라이언스', en: 'Compliance' },
  studio:       { ko: '스튜디오',     en: 'Studio' },
};

function App() {
  const { lang, setLang, t } = useLang();
  const [activeTab, setActiveTab] = useState('intelligence');
  const [playbookNode, setPlaybookNode] = useState(null);
  const [playbookIndustry, setPlaybookIndustry] = useState('ecommerce');

  // Shared state lifted from Intelligence → Compliance
  const [complianceData, setComplianceData] = useState(null);
  const [meetingData, setMeetingData] = useState(null);

  const handleNavigatePlaybook = useCallback((nodeName, industry) => {
    setPlaybookNode(nodeName || null);
    setPlaybookIndustry(industry || 'ecommerce');
    setActiveTab('response');
  }, []);

  const pageTitle = PAGE_TITLES[activeTab]?.[lang] || PAGE_TITLES.intelligence[lang];

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lang={lang}
        onLangToggle={() => setLang(lang === 'ko' ? 'en' : 'ko')}
      />

      {/* Content area */}
      <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
        <TopBar title={pageTitle} />

        <main className="flex-1 px-6 py-5">
          {/* RiskIntelligence: display:none to preserve internal state */}
          <div style={{ display: activeTab === 'intelligence' ? undefined : 'none' }}>
            <ErrorBoundary>
              <RiskIntelligence
                onNavigatePlaybook={handleNavigatePlaybook}
                onComplianceData={setComplianceData}
                onMeetingData={setMeetingData}
              />
            </ErrorBoundary>
          </div>

          {activeTab === 'response' && (
            <div className="space-y-6">
              {/* Playbook Header Context */}
              <ErrorBoundary>
                <RiskPlaybook
                  key={playbookNode}
                  nodeName={playbookNode}
                  industry={playbookIndustry}
                  onBack={() => {
                    setActiveTab('intelligence');
                    requestAnimationFrame(() => {
                      document.getElementById('ontology-graph')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }}
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <AgentSetup />
              </ErrorBoundary>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <ErrorBoundary>
                <ComplianceTracker />
              </ErrorBoundary>

              {/* Reports from Intelligence scan */}
              {(complianceData || meetingData) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {complianceData && (
                    <ErrorBoundary>
                      <ComplianceReport data={complianceData} />
                    </ErrorBoundary>
                  )}
                  {meetingData && (
                    <ErrorBoundary>
                      <MeetingAgenda data={meetingData} />
                    </ErrorBoundary>
                  )}
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 text-center">
                  <p className="text-sm text-zinc-500">{t('compliance.runScanHint')}</p>
                </div>
              )}

              {/* Audit Trail */}
              <ErrorBoundary>
                <AuditTimeline />
              </ErrorBoundary>
            </div>
          )}

          {activeTab === 'studio' && (
            <ErrorBoundary>
              <OntologyStudio />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

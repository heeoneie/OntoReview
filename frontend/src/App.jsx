import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import { LangProvider } from './contexts/LangProvider';
import './styles/tokens.css';
import './styles/marketing.css';
import './index.css';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <a href="#main-content" className="lp-skiplink">Skip to main content</a>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </LangProvider>
  );
}

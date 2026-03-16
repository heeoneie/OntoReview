import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, Radio } from 'lucide-react';

const STEPS = [
  { label: 'Receiving & clustering signals from 4 channels', duration: 2000 },
  { label: 'Ontology engine causal analysis', duration: 8000 },
  { label: 'Generating compliance risk report', duration: 8000 },
  { label: 'Generating executive meeting agenda', duration: 8000 },
  { label: 'Aggregating results & calculating risk level', duration: 3000 },
];

const FULL_DEMO_STEPS = [
  { label: 'Collecting reviews & classifying risks', duration: 4000 },
  { label: 'AI risk analysis (ontology · compliance · agenda)', duration: 12000 },
  { label: 'Refreshing dashboard KPIs', duration: 3000 },
  { label: 'Web discovery & brand risk scan', duration: 5000 },
  { label: 'Finalizing results', duration: 1000 },
];

const FULL_DEMO_PARALLEL = [1, 2];

const PARALLEL = [1, 2, 3];

export default function RiskLoadingSpinner({ mode = 'demo' }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = mode === 'single'
    ? [
        { label: 'Collecting analysis data', duration: 2000 },
        { label: 'Running AI analysis', duration: 10000 },
        { label: 'Compiling results', duration: 2000 },
      ]
    : mode === 'fullDemo'
    ? FULL_DEMO_STEPS
    : STEPS;

  useEffect(() => {
    const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 100;

      let accumulated = 0;
      for (let i = 0; i < steps.length; i++) {
        accumulated += steps[i].duration;
        if (elapsed < accumulated) {
          setCurrentStep(i);
          break;
        }
        if (i === steps.length - 1) setCurrentStep(i);
      }

      setProgress(Math.min(95, Math.round((elapsed / totalDuration) * 100)));
      if (elapsed >= totalDuration) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isParallel = (idx) =>
    mode === 'demo' ? PARALLEL.includes(idx)
    : mode === 'fullDemo' ? FULL_DEMO_PARALLEL.includes(idx)
    : false;
  const parallelMax = mode === 'fullDemo' ? 2 : 3;
  const isActive = (idx) =>
    isParallel(idx) ? currentStep >= 1 && currentStep <= parallelMax : idx === currentStep;
  const isDone = (idx) =>
    isParallel(idx) ? currentStep > parallelMax : idx < currentStep;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8">
      <div className="flex flex-col items-center">
        {/* Progress circle */}
        <div className="relative mb-6">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
            <circle
              cx="48" cy="48" r="40"
              stroke="#ffffff"
              strokeWidth="8"
              fill="none"
              strokeDasharray={251.2}
              strokeDashoffset={251.2 - (251.2 * progress) / 100}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{progress}%</span>
          </div>
        </div>

        {/* Current task */}
        <div className="flex items-center gap-2 mb-6">
          <Radio className="text-white animate-pulse" size={16} />
          <p className="text-sm font-medium text-zinc-300">
            {mode === 'demo'
              ? currentStep <= 3
                ? 'AI engine parallel analysis in progress...'
                : 'Aggregating results...'
              : mode === 'fullDemo'
              ? currentStep <= parallelMax
                ? 'Running full analysis...'
                : (steps[currentStep]?.label || 'Processing...')
              : (steps[currentStep]?.label || 'Analyzing...')}
          </p>
        </div>

        {/* Step list */}
        <div className="w-full max-w-md space-y-1.5">
          {steps.map((step, idx) => {
            const done = isDone(idx);
            const active = isActive(idx);
            const parallel = isParallel(idx);

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-sm ${
                  done
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : active
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800'
                }`}
              >
                {done ? (
                  <CheckCircle size={15} className="text-white flex-shrink-0" />
                ) : active ? (
                  <Loader2 size={15} className="animate-spin text-white flex-shrink-0" />
                ) : (
                  <div className="w-[15px] h-[15px] rounded-full border border-zinc-700 flex-shrink-0" />
                )}
                <span className="font-medium">{step.label}</span>
                {parallel && (
                  <span className="ml-auto text-sm text-zinc-500 font-semibold border border-zinc-700 px-1.5 rounded">parallel</span>
                )}
              </div>
            );
          })}
        </div>

        {(mode === 'demo' || mode === 'fullDemo') && (
          <p className="mt-4 text-sm text-zinc-600">
            {mode === 'fullDemo'
              ? 'AI analysis & dashboard refresh running in parallel'
              : 'Ontology · compliance · agenda generating simultaneously'}
          </p>
        )}
      </div>
    </div>
  );
}

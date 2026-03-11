import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, Radio } from 'lucide-react';

const STEPS = [
  { label: '4개 채널 신호 수신 및 클러스터링', duration: 2000 },
  { label: '온톨로지 엔진 인과관계 분석', duration: 8000 },
  { label: '컴플라이언스 리스크 보고서 생성', duration: 8000 },
  { label: '경영진 긴급 회의 안건 생성', duration: 8000 },
  { label: '결과 통합 및 리스크 레벨 산정', duration: 3000 },
];

const FULL_DEMO_STEPS = [
  { label: '리뷰 수집 및 리스크 분류', duration: 4000 },
  { label: 'AI 리스크 분석 (온톨로지·컴플라이언스·회의안건)', duration: 12000 },
  { label: '대시보드 KPI 갱신', duration: 3000 },
  { label: '웹 탐색 및 브랜드 리스크 스캔', duration: 5000 },
  { label: '결과 통합 완료', duration: 1000 },
];

const FULL_DEMO_PARALLEL = [1, 2];

const PARALLEL = [1, 2, 3];

export default function RiskLoadingSpinner({ mode = 'demo' }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = mode === 'single'
    ? [
        { label: '분석 데이터 수집 중', duration: 2000 },
        { label: 'AI 분석 실행 중', duration: 10000 },
        { label: '결과 정리 중', duration: 2000 },
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
        {/* 원형 진행률 */}
        <div className="relative mb-6">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
            <circle
              cx="48" cy="48" r="40"
              stroke="#0ea5e9"
              strokeWidth="8"
              fill="none"
              strokeDasharray={251.2}
              strokeDashoffset={251.2 - (251.2 * progress) / 100}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-sky-400">{progress}%</span>
          </div>
        </div>

        {/* 현재 작업 */}
        <div className="flex items-center gap-2 mb-6">
          <Radio className="text-sky-400 animate-pulse" size={16} />
          <p className="text-sm font-medium text-zinc-300">
            {mode === 'demo'
              ? currentStep <= 3
                ? 'AI 엔진 병렬 분석 중...'
                : '결과 통합 중...'
              : mode === 'fullDemo'
              ? currentStep <= parallelMax
                ? 'Full Demo 실행 중...'
                : (steps[currentStep]?.label || '처리 중...')
              : (steps[currentStep]?.label || '분석 중...')}
          </p>
        </div>

        {/* 단계 목록 */}
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
                    ? 'bg-sky-950/50 text-sky-400 border border-sky-900'
                    : active
                      ? 'bg-sky-950/50 text-sky-300 border border-sky-900'
                      : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800'
                }`}
              >
                {done ? (
                  <CheckCircle size={15} className="text-sky-400 flex-shrink-0" />
                ) : active ? (
                  <Loader2 size={15} className="animate-spin text-sky-400 flex-shrink-0" />
                ) : (
                  <div className="w-[15px] h-[15px] rounded-full border border-zinc-700 flex-shrink-0" />
                )}
                <span className="font-medium">{step.label}</span>
                {parallel && (
                  <span className="ml-auto text-[10px] text-sky-500 font-semibold border border-sky-900 px-1.5 rounded">병렬</span>
                )}
              </div>
            );
          })}
        </div>

        {(mode === 'demo' || mode === 'fullDemo') && (
          <p className="mt-4 text-xs text-zinc-600">
            {mode === 'fullDemo'
              ? 'AI 분석 · 대시보드 갱신 병렬 처리 중'
              : '온톨로지 · 컴플라이언스 · 회의안건 동시 생성 중'}
          </p>
        )}
      </div>
    </div>
  );
}

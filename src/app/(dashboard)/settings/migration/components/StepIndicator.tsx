'use client';

import React from 'react';

interface Step {
  num: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (stepNum: number) => void;
}

const steps: Step[] = [
  { num: 1, label: '파일 업로드' },
  { num: 2, label: '데이터 매핑' },
  { num: 3, label: '업로드 하기' },
];

export default function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const handleStepClick = (stepNum: number) => {
    // Only allow clicking on previous steps (not current or future)
    if (onStepClick && stepNum < currentStep) {
      onStepClick(stepNum);
    }
  };

  return (
    <div className="flex items-center justify-center mb-4" role="list" aria-label="마이그레이션 단계">
      {steps.map((step, index) => {
        const isClickable = onStepClick && step.num < currentStep;
        const isPast = currentStep > step.num;
        const isCurrent = currentStep === step.num;
        
        return (
          <React.Fragment key={step.num}>
            {/* Step Circle - Clickable for past steps */}
            <div className="flex flex-col items-center" role="listitem">
              <button
                onClick={() => handleStepClick(step.num)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${step.label}${isCurrent ? ' (현재 단계)' : isPast ? ' (완료됨)' : ' (대기 중)'}`}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isCurrent
                    ? 'bg-primary text-white shadow-lg'
                    : isPast
                    ? 'bg-primary text-white shadow-lg hover:bg-primary/80 cursor-pointer'
                    : 'bg-gray-200 text-gray-500'
                } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {isPast ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.num
                )}
              </button>
              <span
                className={`mt-2 text-sm font-medium ${
                  isCurrent || isPast ? 'text-primary' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`w-24 h-1 mx-2 transition-all duration-200 ${
                  currentStep > step.num ? 'bg-primary' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

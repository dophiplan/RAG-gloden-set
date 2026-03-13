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
    <div className="flex items-center justify-center mb-4">
      {steps.map((step, index) => {
        const isClickable = onStepClick && step.num < currentStep;
        const isPast = currentStep > step.num;
        const isCurrent = currentStep === step.num;
        
        return (
          <React.Fragment key={step.num}>
            {/* Step Circle - Clickable for past steps */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleStepClick(step.num)}
                disabled={!isClickable}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 ${
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
                } ${isClickable ? 'cursor-pointer hover:underline' : ''}`}
                onClick={() => handleStepClick(step.num)}
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
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

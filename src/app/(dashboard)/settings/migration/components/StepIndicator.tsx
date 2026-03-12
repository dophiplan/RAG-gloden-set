'use client';

import React from 'react';

interface Step {
  num: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
}

const steps: Step[] = [
  { num: 1, label: '파일 업로드' },
  { num: 2, label: '정보 입력' },
  { num: 3, label: '텍스트 확인' },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={step.num}>
          {/* Step Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 ${
                currentStep >= step.num
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {currentStep > step.num ? (
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
            </div>
            <span
              className={`mt-2 text-sm font-medium ${
                currentStep >= step.num ? 'text-primary' : 'text-gray-500'
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
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

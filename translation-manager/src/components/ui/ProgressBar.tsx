'use client';

import React from 'react';

export type ProgressBarColor = 'blue' | 'green' | 'yellow' | 'red';
export type ProgressBarSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  value: number;
  color?: ProgressBarColor;
  showLabel?: boolean;
  size?: ProgressBarSize;
  className?: string;
  animated?: boolean;
}

const colorClasses: Record<ProgressBarColor, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
  red: 'bg-red-600',
};

const backgroundClasses: Record<ProgressBarColor, string> = {
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  yellow: 'bg-yellow-100',
  red: 'bg-red-100',
};

const sizeClasses: Record<ProgressBarSize, string> = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

const labelSizeClasses: Record<ProgressBarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export default function ProgressBar({
  value,
  color = 'blue',
  showLabel = true,
  size = 'md',
  className = '',
  animated = true,
}: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const roundedValue = Math.round(clampedValue);

  // Determine color based on value if not explicitly set
  const getAutoColor = (): ProgressBarColor => {
    if (clampedValue >= 80) return 'green';
    if (clampedValue >= 50) return 'blue';
    if (clampedValue >= 30) return 'yellow';
    return 'red';
  };

  const barColor = color || getAutoColor();

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div
            className={`
              w-full rounded-full overflow-hidden
              ${backgroundClasses[barColor]}
              ${sizeClasses[size]}
            `}
            role="progressbar"
            aria-valuenow={roundedValue}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress: ${roundedValue}%`}
          >
            <div
              className={`
                h-full rounded-full
                ${colorClasses[barColor]}
                ${animated ? 'transition-all duration-500 ease-out' : ''}
              `}
              style={{ width: `${clampedValue}%` }}
            >
              {animated && (
                <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer" />
              )}
            </div>
          </div>
        </div>
        {showLabel && (
          <div
            className={`
              font-semibold tabular-nums flex-shrink-0
              ${labelSizeClasses[size]}
              ${colorClasses[barColor].replace('bg-', 'text-')}
            `}
          >
            {roundedValue}%
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for displaying progress with a label
export function ProgressBarWithLabel({
  label,
  value,
  color,
  size = 'md',
  className = '',
}: ProgressBarProps & { label: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{Math.round(value)}%</span>
      </div>
      <ProgressBar value={value} color={color} size={size} showLabel={false} />
    </div>
  );
}

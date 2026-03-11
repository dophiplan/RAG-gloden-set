'use client';

import { useMemo } from 'react';

interface StatusTabsProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  stats?: {
    pending?: number;
    reviewed?: number;
    re_deploy?: number;
    deployed?: number;
    not_deployed?: number;
  };
}

const statusConfig = [
  { key: '', label: '전체', color: 'slate' },
  { key: 'pending', label: '번역 요청', color: 'amber' },
  { key: 'reviewed', label: '검수 완료', color: 'blue' },
  { key: 're_deploy', label: '재반영 요청', color: 'orange' },
  { key: 'deployed', label: '반영완료', color: 'emerald' },
  { key: 'not_deployed', label: '미반영', color: 'gray' },
];

const colorClasses: Record<string, { active: string; inactive: string; empty: string }> = {
  slate: {
    active: 'bg-slate-200 text-slate-700 ring-2 ring-slate-400',
    inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    empty: 'bg-gray-100 text-gray-400',
  },
  amber: {
    active: 'bg-amber-100 text-amber-700 ring-2 ring-amber-300',
    inactive: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    empty: 'bg-gray-100 text-gray-400',
  },
  blue: {
    active: 'bg-blue-100 text-blue-700 ring-2 ring-blue-300',
    inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    empty: 'bg-gray-100 text-gray-400',
  },
  orange: {
    active: 'bg-orange-100 text-orange-700 ring-2 ring-orange-300',
    inactive: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    empty: 'bg-gray-100 text-gray-400',
  },
  emerald: {
    active: 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300',
    inactive: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
    empty: 'bg-gray-100 text-gray-400',
  },
  gray: {
    active: 'bg-gray-200 text-gray-700 ring-2 ring-gray-400',
    inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    empty: 'bg-gray-100 text-gray-400',
  },
};

export function StatusTabs({ activeStatus, onStatusChange, stats = {} }: StatusTabsProps) {
  const getCount = (key: string) => {
    if (!key) {
      // 전체 카운트
      return Object.values(stats).reduce((sum, count) => sum + (count || 0), 0);
    }
    return stats[key as keyof typeof stats] || 0;
  };

  const getClass = (status: typeof statusConfig[0], count: number) => {
    const isActive = activeStatus === status.key;
    const isEmpty = count === 0;
    const colors = colorClasses[status.color];

    if (isEmpty && status.key !== '') return colors.empty;
    if (isActive) return colors.active;
    return colors.inactive;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-2 flex-wrap">
        {statusConfig.map((status) => {
          const count = getCount(status.key);
          
          return (
            <button
              key={status.key}
              onClick={() => onStatusChange(status.key === activeStatus ? '' : status.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${getClass(status, count)}`}
            >
              {status.label} ({count})
            </button>
          );
        })}
      </div>
    </div>
  );
}

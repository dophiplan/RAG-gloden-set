'use client';

import { useCallback, KeyboardEvent, useMemo } from 'react';
import { TranslationStats } from '../hooks/useTranslationStats';

interface StatusTabsProps {
  activeStatus: string;
  onStatusChange: (status: string | '') => void;
  stats?: TranslationStats;
}

interface StatusConfig {
  key: string;
  label: string;
  getCount: (stats: TranslationStats) => number;
}

// 상태값 설정 - getCount 함수로 자동 계산
const statusConfig: StatusConfig[] = [
  { 
    key: '', 
    label: '전체', 
    getCount: (stats) => Object.values(stats).reduce((sum, count) => sum + (count || 0), 0) - (stats.total || 0)
  },
  { 
    key: 'pending', 
    label: '요청', 
    getCount: (stats) => stats.pending || 0
  },
  { 
    key: 'in_progress', 
    label: '진행', 
    getCount: (stats) => stats.in_progress || 0
  },
  { 
    key: 'reviewed', 
    label: '검토', 
    getCount: (stats) => stats.reviewed || 0
  },
  { 
    key: 'deployed', 
    label: '완료', 
    getCount: (stats) => stats.deployed || 0
  },
  { 
    key: 're_request', 
    label: '재요청', 
    getCount: (stats) => (stats.re_request || 0) + (stats.re_deploy_request || 0)
  },
  { 
    key: 'not_used', 
    label: '미사용', 
    getCount: (stats) => stats.not_used || 0
  },
];

export function StatusTabs({ activeStatus, onStatusChange, stats = {
  pending: 0, in_progress: 0, reviewed: 0, re_request: 0, 
  deployed: 0, not_used: 0, re_deploy_request: 0, total: 0
} }: StatusTabsProps) {
  // 키보드 네비게이션 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    
    switch (e.key) {
      case 'ArrowLeft':
        nextIndex = index > 0 ? index - 1 : statusConfig.length - 1;
        break;
      case 'ArrowRight':
        nextIndex = index < statusConfig.length - 1 ? index + 1 : 0;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = statusConfig.length - 1;
        break;
      default:
        return;
    }
    
    e.preventDefault();
    const nextTab = statusConfig[nextIndex];
    const nextCount = nextTab.getCount(stats);
    
    // 빈 탭이면 스킵하고 다음으로 이동
    if (nextCount === 0 && nextTab.key !== '') {
      const direction = e.key === 'ArrowRight' || e.key === 'End' ? 1 : -1;
      let checkIndex = nextIndex;
      for (let i = 0; i < statusConfig.length; i++) {
        checkIndex = (checkIndex + direction + statusConfig.length) % statusConfig.length;
        if (statusConfig[checkIndex].getCount(stats) > 0 || statusConfig[checkIndex].key === '') {
          nextIndex = checkIndex;
          break;
        }
      }
    }
    
    const targetTab = statusConfig[nextIndex];
    onStatusChange(targetTab.key === activeStatus ? '' : targetTab.key);
    
    // Focus the next tab
    document.getElementById(`status-tab-${targetTab.key}`)?.focus();
  }, [activeStatus, onStatusChange, stats]);

  // 카운트 계산 메모이제이션
  const counts = useMemo(() => {
    return statusConfig.map(config => ({
      key: config.key,
      count: config.getCount(stats),
    }));
  }, [stats]);

  return (
    <div 
      className="bg-transparent border-b-2 border-border"
      role="tablist"
      aria-label="번역 상태 필터"
    >
      <nav className="-mb-px flex flex-nowrap space-x-1 overflow-x-auto px-3 py-2">
        {statusConfig.map((status, index) => {
          const count = counts.find(c => c.key === status.key)?.count || 0;
          const isActive = activeStatus === status.key;
          const isEmpty = count === 0 && status.key !== '';
          
          return (
            <button
              key={status.key}
              id={`status-tab-${status.key}`}
              role="tab"
              aria-selected={isActive}
              aria-controls="translation-table-panel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => !isEmpty && onStatusChange(status.key === activeStatus ? '' : status.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={isEmpty}
              className={`
                whitespace-nowrap py-3 px-4 md:px-6 border-b-3 font-bold text-sm transition-all duration-200 rounded-t-xl
                min-w-[80px] flex-shrink-0
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                ${
                  isActive
                    ? 'border-primary text-primary-active bg-gradient-to-t from-primary-light to-white shadow-lg transform translate-y-0.5'
                    : isEmpty
                      ? 'border-transparent text-gray-300 cursor-not-allowed'
                      : 'border-transparent text-text-secondary hover:text-primary-active hover:bg-white/50'
                }
              `}
              style={isActive ? {
                boxShadow: '0 -2px 8px rgba(123, 201, 111, 0.2)'
              } : undefined}
            >
              {status.label}
              <span className={`ml-1.5 ${isEmpty ? 'text-gray-300' : ''}`} aria-label={`${count}개`}>
                {count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

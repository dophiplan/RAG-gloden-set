'use client';

import Link from 'next/link';

interface QuickActionsProps {
  glossaryCount?: number;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

// 날짜 선택기만
export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: Omit<QuickActionsProps, 'glossaryCount'>) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary"
      />
      <span className="text-xs text-text-muted">~</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary"
      />
    </div>
  );
}

// 액션 버튼들만
export function ActionButtons() {
  return (
    <div className="flex items-center gap-2">
      {/* 번역 요청 */}
      <Link
        href="/upload"
        className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-semibold text-text-secondary hover:text-primary-active hover:border-primary hover:bg-white/80 transition-all duration-200"
      >
        번역 요청
      </Link>

      {/* 번역 관리 */}
      <Link
        href="/translations"
        className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-semibold text-text-secondary hover:text-primary-active hover:border-primary hover:bg-white/80 transition-all duration-200"
      >
        번역 관리
      </Link>

      {/* 용어집 관리 */}
      <Link
        href="/glossary"
        className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-semibold text-text-secondary hover:text-primary-active hover:border-primary hover:bg-white/80 transition-all duration-200"
      >
        용어집 관리
      </Link>
    </div>
  );
}

// 기존 전체 컴포넌트 (하위 호환성)
export default function QuickActions({
  glossaryCount = 0,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: QuickActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
      />

      {/* 구분선 */}
      <div className="h-5 w-px bg-border-divider"></div>

      <ActionButtons />
    </div>
  );
}

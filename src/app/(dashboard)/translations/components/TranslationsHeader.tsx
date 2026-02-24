import { useRouter } from 'next/navigation';
import { Translation } from '@/types';
import { usePlatforms } from '@/hooks/useReferenceData';

interface TranslationsHeaderProps {
  // Original naming (kept for backward compatibility)
  onOpenCreateModal?: () => void;
  // Alternative naming (for backward compatibility)
  onCreateClick?: () => void;
  selectedCount?: number;
  onShowHistory?: () => void;
  translations?: Translation[];
  versionFilter?: string;
  // Email and download handlers
  onEmailClick?: () => void;
  onDownloadExcel?: () => void;
  onDownloadAllExcel?: () => void;
  hasSelectedTranslations?: boolean;
  canEmail?: boolean;
}

export default function TranslationsHeader({
  onOpenCreateModal,
  onCreateClick,
  selectedCount = 0,
  onShowHistory,
  translations = [],
  versionFilter = '',
  onEmailClick,
  onDownloadExcel,
  onDownloadAllExcel,
  hasSelectedTranslations,
  canEmail,
}: TranslationsHeaderProps) {
  // Props kept for backward compatibility, but create button moved to parent
  void onOpenCreateModal;
  void onCreateClick;
  const { platformsMap } = usePlatforms();

  // Calculate platform completion statistics when version filter is active
  const platformStats = (() => {
    if (!versionFilter || translations.length === 0) return null;

    const stats: Record<string, { total: number; completed: number }> = {};

    translations.forEach(translation => {
      const platforms = translation.translation_platforms || [];
      const completions = translation.platform_completions || {};

      platforms.forEach(tp => {
        const code = tp.platform_code;
        if (!stats[code]) {
          stats[code] = { total: 0, completed: 0 };
        }
        stats[code].total += 1;
        if (completions[code]?.completed) {
          stats[code].completed += 1;
        }
      });
    });

    return Object.entries(stats)
      .map(([code, { total, completed }]) => ({
        code,
        name: platformsMap[code]?.name || code,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed,
        total
      }))
      .sort((a, b) => b.rate - a.rate);
  })();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* 버전 기록 버튼 */}
        {onShowHistory && (
          <button
            onClick={onShowHistory}
            disabled={selectedCount === 0}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors ${
              selectedCount > 0
                ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title={selectedCount > 0 ? '버전 기록 보기' : '번역을 선택하세요'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">버전 기록</span>
            {selectedCount > 0 && (
              <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Platform Statistics - only show when version filter is active */}
        {platformStats && platformStats.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-xs font-medium text-gray-600">플랫폼 반영률:</span>
            <div className="flex items-center gap-3">
              {platformStats.map(stat => (
                <div key={stat.code} className="flex items-center gap-1.5" title={`${stat.completed}/${stat.total} 완료`}>
                  <span className="text-xs text-gray-700 font-medium">{stat.name}</span>
                  <span className={`text-xs font-bold ${
                    stat.rate === 100 ? 'text-green-600' :
                    stat.rate >= 70 ? 'text-blue-600' :
                    stat.rate >= 40 ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {stat.rate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

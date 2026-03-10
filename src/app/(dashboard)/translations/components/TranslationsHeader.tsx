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
        {/* 버전 기록 버튼은 TranslationBulkActionBar로 이동 */}
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

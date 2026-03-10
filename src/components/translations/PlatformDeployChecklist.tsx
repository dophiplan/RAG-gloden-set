'use client';

import { useCallback } from 'react';
import { usePlatformDeployStatus } from '@/app/(dashboard)/translations/hooks/usePlatformDeployStatus';
import { usePlatforms } from '@/hooks/useReferenceData';

interface PlatformDeployChecklistProps {
  translationId: string;
  onStatusChanged?: () => void;
}

export function PlatformDeployChecklist({ translationId, onStatusChanged }: PlatformDeployChecklistProps) {
  const { status, loading, updatePlatformStatus } = usePlatformDeployStatus(translationId);
  const { platforms: allPlatforms } = usePlatforms();

  const handleToggle = useCallback(async (platformCode: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await updatePlatformStatus(platformCode, newStatus);
      onStatusChanged?.();
    } catch (error) {
      // Error handled by hook
    }
  }, [updatePlatformStatus, onStatusChanged]);

  if (loading || !status) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        로딩 중...
      </div>
    );
  }

  const { platforms, progress, all_completed } = status;

  // 플랫폼 코드 → 이름 매핑
  const platformMap = new Map(allPlatforms.map(p => [p.code, p.name]));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          플랫폼별 배포 상태
        </h4>
        <span className={`text-xs font-medium ${all_completed ? 'text-green-600' : 'text-orange-600'}`}>
          {progress}%
        </span>
      </div>
      
      {/* 진척률 바 */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${all_completed ? 'bg-green-500' : 'bg-orange-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 플랫폼 체크리스트 */}
      <div className="flex flex-wrap gap-2 mt-2 max-w-full">
        {platforms.map((platform) => (
          <label
            key={platform.platform_code}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-pointer transition-colors flex-shrink-0 ${
              platform.deploy_status === 'completed'
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={platform.deploy_status === 'completed'}
              onChange={() => handleToggle(platform.platform_code, platform.deploy_status)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-3.5 h-3.5"
            />
            <span className="text-xs whitespace-nowrap">{platformMap.get(platform.platform_code) || platform.platform_code}</span>
          </label>
        ))}
      </div>

      {all_completed && (
        <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          모든 플랫폼 배포 완료 - 자동으로 반영완료 상태로 전환됩니다
        </div>
      )}
    </div>
  );
}

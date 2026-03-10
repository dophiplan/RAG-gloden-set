'use client';

import { usePlatformDeployStatus } from '@/app/(dashboard)/translations/hooks/usePlatformDeployStatus';

interface PlatformDeployProgressProps {
  translationId: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function PlatformDeployProgress({ 
  translationId, 
  showDetails = false,
  compact = false 
}: PlatformDeployProgressProps) {
  const { status, loading } = usePlatformDeployStatus(translationId);

  if (loading || !status) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded ${compact ? 'h-4 w-16' : 'h-2 w-20'}`} />
    );
  }

  const { progress, completed_count, total_count, all_completed } = status;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              all_completed ? 'bg-green-500' : 'bg-orange-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-xs ${all_completed ? 'text-green-600' : 'text-orange-600'}`}>
          {completed_count}/{total_count}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              all_completed ? 'bg-green-500' : 'bg-orange-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${all_completed ? 'text-green-600' : 'text-orange-600'}`}>
          {progress}%
        </span>
      </div>
      
      {showDetails && (
        <div className="text-xs text-gray-500">
          {completed_count} / {total_count} 플랫폼 완료
        </div>
      )}
    </div>
  );
}

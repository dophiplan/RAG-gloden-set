'use client';

import React, { useState } from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { Translation } from '@/types';

interface DeploymentProgressCellProps {
  translation: Translation;
  onOpenDeploymentModal: (translation: Translation) => void;
}

export default function DeploymentProgressCell({
  translation,
  onOpenDeploymentModal,
}: DeploymentProgressCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const { completion_rate, platform_completions, work_scope } = translation;

  // Get platform completion details
  const platformDetails = work_scope.map((platform) => {
    const completion = platform_completions?.[platform];
    return {
      platform,
      completed: completion?.completed || false,
      completed_at: completion?.completed_at,
      completed_by: completion?.completed_by,
    };
  });

  const completedCount = platformDetails.filter((p) => p.completed).length;
  const totalCount = platformDetails.length;

  return (
    <div className="relative">
      <div
        className="cursor-pointer"
        onClick={() => onOpenDeploymentModal(translation)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <ProgressBar
          value={completion_rate}
          size="sm"
          showLabel={true}
          className="min-w-[100px]"
        />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">
            Deployment Progress ({completedCount}/{totalCount})
          </div>
          <div className="space-y-2">
            {platformDetails.map(({ platform, completed, completed_at, completed_by }) => (
              <div
                key={platform}
                className="flex items-start justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      completed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <span className="font-medium text-gray-700">{platform}</span>
                </div>
                <div className="text-right text-gray-500">
                  {completed ? (
                    <div className="space-y-0.5">
                      {completed_at && (
                        <div>
                          {new Date(completed_at).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                      {completed_by && (
                        <div className="text-[10px]">{completed_by}</div>
                      )}
                    </div>
                  ) : (
                    <span>Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
            Click to update deployment status
          </div>
        </div>
      )}
    </div>
  );
}

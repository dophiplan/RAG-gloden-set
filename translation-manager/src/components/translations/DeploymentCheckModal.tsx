'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import { Translation } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface DeploymentCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  translation: Translation;
  onUpdate?: () => void;
}

interface PlatformCheckState {
  [platform: string]: boolean;
}

export default function DeploymentCheckModal({
  isOpen,
  onClose,
  translation,
  onUpdate,
}: DeploymentCheckModalProps) {
  const [checkedPlatforms, setCheckedPlatforms] = useState<PlatformCheckState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showEmailSuggestion, setShowEmailSuggestion] = useState(false);

  const supabase = createClient();

  // Initialize checked platforms from translation data
  useEffect(() => {
    if (isOpen && translation) {
      const initialState: PlatformCheckState = {};
      translation.work_scope.forEach((platform) => {
        initialState[platform] = translation.platform_completions?.[platform]?.completed || false;
      });
      setCheckedPlatforms(initialState);
      setError(null);
      setShowEmailSuggestion(false);
    }
  }, [isOpen, translation]);

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user?.email || null);
    };
    fetchUser();
  }, []);

  // Calculate completion rate
  const completionRate = useMemo(() => {
    const totalPlatforms = translation.work_scope.length;
    if (totalPlatforms === 0) return 0;

    const completedCount = Object.values(checkedPlatforms).filter(Boolean).length;
    return Math.round((completedCount / totalPlatforms) * 100);
  }, [checkedPlatforms, translation.work_scope]);

  // Check if 100% completed
  useEffect(() => {
    if (completionRate === 100 && !showEmailSuggestion) {
      setShowEmailSuggestion(true);
    } else if (completionRate < 100) {
      setShowEmailSuggestion(false);
    }
  }, [completionRate]);

  // Handle platform checkbox toggle
  const handlePlatformToggle = (platform: string) => {
    setCheckedPlatforms((prev) => ({
      ...prev,
      [platform]: !prev[platform],
    }));
  };

  // Save deployment completion
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Build updated platform_completions object
      const updatedCompletions: Translation['platform_completions'] = {};
      const timestamp = new Date().toISOString();

      translation.work_scope.forEach((platform) => {
        const wasCompleted = translation.platform_completions?.[platform]?.completed || false;
        const isNowCompleted = checkedPlatforms[platform] || false;

        if (isNowCompleted) {
          updatedCompletions[platform] = {
            completed: true,
            completed_at:
              wasCompleted && translation.platform_completions?.[platform]?.completed_at
                ? translation.platform_completions[platform].completed_at
                : timestamp,
            completed_by:
              wasCompleted && translation.platform_completions?.[platform]?.completed_by
                ? translation.platform_completions[platform].completed_by
                : currentUser || 'Unknown',
          };
        } else {
          updatedCompletions[platform] = {
            completed: false,
          };
        }
      });

      // Call API to update translation
      const response = await fetch(`/api/translations/${translation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_completions: updatedCompletions,
          completion_rate: completionRate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update deployment status');
      }

      // Success - call onUpdate callback and close modal
      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Deployment Status" size="lg">
      <div className="space-y-4">
        {/* Progress Display */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-lg font-bold text-gray-900">{completionRate}%</span>
          </div>
          <ProgressBar value={completionRate} size="md" showLabel={false} />
        </div>

        {/* Platform Checkboxes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Completed Platforms
          </label>
          <div className="space-y-2 border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
            {translation.work_scope.map((platform) => {
              const completion = translation.platform_completions?.[platform];
              const isChecked = checkedPlatforms[platform] || false;
              const wasCompleted = completion?.completed || false;

              return (
                <div
                  key={platform}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handlePlatformToggle(platform)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{platform}</span>
                  </label>

                  {/* Display completion info if already completed */}
                  {wasCompleted && completion && (
                    <div className="text-xs text-gray-500 text-right">
                      {completion.completed_at && (
                        <div>
                          {new Date(completion.completed_at).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                      {completion.completed_by && (
                        <div className="text-[10px]">{completion.completed_by}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 100% Completion Suggestion */}
        {showEmailSuggestion && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-green-800 mb-1">
                  Deployment Complete!
                </h4>
                <p className="text-sm text-green-700">
                  All platforms have been deployed. Consider sending a deployment completion email
                  to notify the team.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

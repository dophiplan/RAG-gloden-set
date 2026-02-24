'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VersionItem } from './VersionItem';
import { apiGet, apiPost } from '@/lib/api-utils';

interface VersionHistory {
  id: string;
  type: 'audit' | 'translation';
  action: string;
  fieldName: string;
  changeDescription: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
  changedBy: string;
}

interface VersionHistoryPanelProps {
  translationId: string;
  languageCode: string;
  curre[기밀마스킹]ext: string;
}

export function VersionHistoryPanel({
  translationId,
  languageCode,
  curre[기밀마스킹]ext,
}: VersionHistoryPanelProps) {
  const [logs, setLogs] = useState<VersionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // 버전 히스토리 불러오기
  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<VersionHistory[]>(`/api/translations/${translationId}/logs?language=${languageCode}`);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  // 복구 처리
  const handleRevert = async (logId: string) => {
    if (!confirm('이 버전으로 복구하시겠습니까?')) return;

    try {
      await apiPost(`/api/translations/${translationId}/revert`, { logId, languageCode });

      // 성공 후 목록 새로고침
      await fetchLogs();
      alert('복구가 완료되었습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '복구에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (translationId && languageCode) {
      fetchLogs();
    }
  }, [translationId, languageCode]);

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">불러오는 중...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">{error}</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">버전 기록</h3>
        <p className="text-xs text-gray-500 mt-1">변경 이력을 확인하고 복구할 수 있습니다.</p>
      </div>

      {/* 버전 목록 */}
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 text-center">
            변경 이력이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log, index) => (
              <VersionItem
                key={log.id}
                log={log}
                isCurrent={log.action === 'current'}
                onRevert={
                  log.action !== 'current' && log.type === 'translation'
                    ? () => handleRevert(log.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

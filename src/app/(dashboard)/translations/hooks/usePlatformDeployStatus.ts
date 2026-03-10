import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/api-utils';

interface PlatformDeployStatus {
  platform_code: string;
  deploy_status: 'pending' | 'completed';
}

interface DeployStatusResponse {
  platforms: PlatformDeployStatus[];
  progress: number;
  completed_count: number;
  total_count: number;
  all_completed: boolean;
}

export function usePlatformDeployStatus(translationId: string | null) {
  const [status, setStatus] = useState<DeployStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!translationId) return;
    
    setLoading(true);
    try {
      const data = await apiGet<DeployStatusResponse>(`/api/translations/${translationId}/platforms`);
      setStatus(data);
    } catch (error) {
      console.error('Error fetching platform status:', error);
    } finally {
      setLoading(false);
    }
  }, [translationId]);

  const updatePlatformStatus = useCallback(async (
    platformCode: string, 
    deployStatus: 'pending' | 'completed'
  ) => {
    if (!translationId) return;

    try {
      await apiPatch(`/api/translations/${translationId}/platforms`, {
        platform_code: platformCode,
        deploy_status: deployStatus,
      });
      // Refresh status after update
      await fetchStatus();
    } catch (error) {
      console.error('Error updating platform status:', error);
      throw error;
    }
  }, [translationId, fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    refresh: fetchStatus,
    updatePlatformStatus,
  };
}

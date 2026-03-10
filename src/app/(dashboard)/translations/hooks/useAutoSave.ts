import { useCallback, useRef, useState } from 'react';

interface UseAutoSaveOptions<T> {
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
}

interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: Date;
}

export function useAutoSave<T>({ onSave, debounceMs = 500 }: UseAutoSaveOptions<T>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: 'idle' });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<T | null>(null);

  const triggerSave = useCallback((data: T) => {
    pendingDataRef.current = data;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setSaveStatus({ status: 'saving' });

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(async () => {
      if (pendingDataRef.current) {
        try {
          await onSave(pendingDataRef.current);
          setSaveStatus({ status: 'saved', lastSavedAt: new Date() });
          
          // Reset to idle after 2 seconds
          setTimeout(() => {
            setSaveStatus({ status: 'idle' });
          }, 2000);
        } catch (error) {
          setSaveStatus({ status: 'error' });
        }
      }
    }, debounceMs);
  }, [onSave, debounceMs]);

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (pendingDataRef.current && saveStatus.status === 'saving') {
      await onSave(pendingDataRef.current);
      setSaveStatus({ status: 'saved', lastSavedAt: new Date() });
    }
  }, [onSave, saveStatus.status]);

  return {
    triggerSave,
    flush,
    saveStatus,
  };
}

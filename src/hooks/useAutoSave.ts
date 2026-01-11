import { useEffect, useRef, useState, useCallback } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  delay?: number; // milliseconds
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  status: SaveStatus;
  lastSaved: Date | null;
  saveNow: () => Promise<void>;
}

export function useAutoSave<T>(
  saveFn: (data: T) => Promise<void>,
  data: T,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const { delay = 30000, enabled = true } = options;

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<T>(data);
  const isMountedRef = useRef(true);

  const performSave = useCallback(async () => {
    if (!enabled) return;

    try {
      setStatus('saving');
      await saveFn(data);

      if (isMountedRef.current) {
        setStatus('saved');
        setLastSaved(new Date());
        previousDataRef.current = data;
      }
    } catch (error) {
      if (isMountedRef.current) {
        setStatus('error');
        console.error('Auto-save failed:', error);
      }
    }
  }, [saveFn, data, enabled]);

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await performSave();
  }, [performSave]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Check if data has actually changed (simple shallow comparison)
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);

    if (!dataChanged) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, enabled, performSave]);

  return {
    status,
    lastSaved,
    saveNow,
  };
}

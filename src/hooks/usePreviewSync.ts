import { useCallback, useEffect, useRef, useState } from 'react';
import type { PricingConfig } from '@/types';

/**
 * Preview form data structure for localStorage sync
 */
export interface PreviewFormData {
  landingPageUrl: string;
  appName: string;
  appIntroduction: string;
  appDescription: string;
  features: string[];
  languages: string[];
  worksWith: string[];
  primaryCategory: string;
  secondaryCategory: string;
  pricing: PricingConfig;
}

interface StoredPreviewData {
  data: PreviewFormData;
  timestamp: number;
}

export interface UsePreviewSyncOptions {
  /**
   * Callback fired when data changes from another tab/window
   */
  onDataChange?: (data: PreviewFormData) => void;
  /**
   * Debounce delay in milliseconds for saving (default: 0 for immediate)
   */
  debounceMs?: number;
}

export interface UsePreviewSyncReturn {
  /**
   * Save form data to localStorage for preview
   */
  saveToPreview: (data: PreviewFormData) => void;
  /**
   * Load form data from localStorage
   */
  loadFromPreview: () => PreviewFormData | null;
  /**
   * Clear preview data from localStorage
   */
  clearPreview: () => void;
  /**
   * Check if preview data exists in localStorage
   */
  hasPreviewData: () => boolean;
  /**
   * Get the age of stored preview data in milliseconds
   */
  getPreviewAge: () => number | null;
  /**
   * Whether live preview mode is enabled
   */
  isLivePreview: boolean;
  /**
   * Enable live preview mode (listens for storage events)
   */
  enableLivePreview: () => void;
  /**
   * Disable live preview mode
   */
  disableLivePreview: () => void;
  /**
   * Timestamp of last sync operation
   */
  lastSynced: Date | null;
}

export const PREVIEW_STORAGE_KEY = 'shopgenfy_preview_data';

/**
 * Check if we're in a browser environment with localStorage available
 */
function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Hook for syncing form data to localStorage for real-time preview
 *
 * Supports:
 * - Saving form data to localStorage with timestamps
 * - Loading form data from localStorage
 * - Live preview mode with cross-tab synchronization
 * - Debounced saves to prevent excessive writes
 * - SSR-safe implementation
 */
export function usePreviewSync(options: UsePreviewSyncOptions = {}): UsePreviewSyncReturn {
  const { onDataChange, debounceMs = 0 } = options;

  const [isLivePreview, setIsLivePreview] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<PreviewFormData | null>(null);
  const onDataChangeRef = useRef(onDataChange);

  // Keep callback ref updated
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  /**
   * Save data to localStorage (internal implementation)
   */
  const saveToStorage = useCallback((data: PreviewFormData) => {
    if (!isLocalStorageAvailable()) return;

    try {
      const storedData: StoredPreviewData = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(storedData));
      setLastSynced(new Date());
    } catch (error) {
      console.error('Failed to save preview data:', error);
    }
  }, []);

  /**
   * Save form data to localStorage for preview (potentially debounced)
   */
  const saveToPreview = useCallback(
    (data: PreviewFormData) => {
      if (debounceMs === 0) {
        saveToStorage(data);
        return;
      }

      // Store pending data
      pendingDataRef.current = data;

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set new debounced timeout
      debounceTimeoutRef.current = setTimeout(() => {
        if (pendingDataRef.current) {
          saveToStorage(pendingDataRef.current);
          pendingDataRef.current = null;
        }
      }, debounceMs);
    },
    [debounceMs, saveToStorage]
  );

  /**
   * Load form data from localStorage
   */
  const loadFromPreview = useCallback((): PreviewFormData | null => {
    if (!isLocalStorageAvailable()) return null;

    try {
      const stored = localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (!stored) return null;

      const parsed: StoredPreviewData = JSON.parse(stored);
      setLastSynced(new Date(parsed.timestamp));
      return parsed.data;
    } catch (error) {
      console.error('Failed to load preview data:', error);
      return null;
    }
  }, []);

  /**
   * Clear preview data from localStorage
   */
  const clearPreview = useCallback(() => {
    if (!isLocalStorageAvailable()) return;

    try {
      localStorage.removeItem(PREVIEW_STORAGE_KEY);
      setLastSynced(null);
    } catch (error) {
      console.error('Failed to clear preview data:', error);
    }
  }, []);

  /**
   * Check if preview data exists in localStorage
   */
  const hasPreviewData = useCallback((): boolean => {
    if (!isLocalStorageAvailable()) return false;

    try {
      return localStorage.getItem(PREVIEW_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }, []);

  /**
   * Get the age of stored preview data in milliseconds
   */
  const getPreviewAge = useCallback((): number | null => {
    if (!isLocalStorageAvailable()) return null;

    try {
      const stored = localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (!stored) return null;

      const parsed: StoredPreviewData = JSON.parse(stored);
      return Date.now() - parsed.timestamp;
    } catch {
      return null;
    }
  }, []);

  /**
   * Enable live preview mode
   */
  const enableLivePreview = useCallback(() => {
    setIsLivePreview(true);
  }, []);

  /**
   * Disable live preview mode
   */
  const disableLivePreview = useCallback(() => {
    setIsLivePreview(false);
  }, []);

  /**
   * Handle storage events from other tabs/windows
   */
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Only react when in live preview mode
      if (!isLivePreview) return;

      // Only handle our storage key
      if (event.key !== PREVIEW_STORAGE_KEY) return;

      if (event.newValue) {
        try {
          const parsed: StoredPreviewData = JSON.parse(event.newValue);
          setLastSynced(new Date(parsed.timestamp));

          if (onDataChangeRef.current) {
            onDataChangeRef.current(parsed.data);
          }
        } catch (error) {
          console.error('Failed to parse storage event data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isLivePreview]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveToPreview,
    loadFromPreview,
    clearPreview,
    hasPreviewData,
    getPreviewAge,
    isLivePreview,
    enableLivePreview,
    disableLivePreview,
    lastSynced,
  };
}

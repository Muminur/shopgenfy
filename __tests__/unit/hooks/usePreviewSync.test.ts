import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePreviewSync } from '@/hooks/usePreviewSync';
import type { PricingConfig } from '@/types';

// Define the preview data type for tests
interface PreviewFormData {
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

const STORAGE_KEY = 'shopgenfy_preview_data';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

describe('usePreviewSync Hook', () => {
  const initialFormData: PreviewFormData = {
    landingPageUrl: '',
    appName: '',
    appIntroduction: '',
    appDescription: '',
    features: [''],
    languages: [],
    worksWith: [],
    primaryCategory: '',
    secondaryCategory: '',
    pricing: { type: 'free' },
  };

  beforeEach(() => {
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveToPreview', () => {
    it('should save form data to localStorage', () => {
      const { result } = renderHook(() => usePreviewSync());

      const formData: PreviewFormData = {
        ...initialFormData,
        appName: 'My Test App',
        appIntroduction: 'A great app',
      };

      act(() => {
        result.current.saveToPreview(formData);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData.data.appName).toBe('My Test App');
      expect(savedData.data.appIntroduction).toBe('A great app');
    });

    it('should include timestamp when saving', () => {
      const { result } = renderHook(() => usePreviewSync());

      act(() => {
        result.current.saveToPreview(initialFormData);
      });

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData.timestamp).toBeDefined();
      expect(typeof savedData.timestamp).toBe('number');
    });

    it('should update lastSynced timestamp after save', () => {
      const { result } = renderHook(() => usePreviewSync());

      expect(result.current.lastSynced).toBeNull();

      act(() => {
        result.current.saveToPreview(initialFormData);
      });

      expect(result.current.lastSynced).toBeInstanceOf(Date);
    });
  });

  describe('loadFromPreview', () => {
    it('should load form data from localStorage', () => {
      const storedData = {
        data: {
          ...initialFormData,
          appName: 'Stored App',
          appDescription: 'Stored description',
        },
        timestamp: Date.now(),
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(storedData));

      const { result } = renderHook(() => usePreviewSync());

      let loadedData: PreviewFormData | null = null;
      act(() => {
        loadedData = result.current.loadFromPreview();
      });

      expect(loadedData).not.toBeNull();
      expect(loadedData!.appName).toBe('Stored App');
      expect(loadedData!.appDescription).toBe('Stored description');
    });

    it('should return null when no data exists', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const { result } = renderHook(() => usePreviewSync());

      let loadedData: PreviewFormData | null = null;
      act(() => {
        loadedData = result.current.loadFromPreview();
      });

      expect(loadedData).toBeNull();
    });

    it('should return null for invalid JSON data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json');

      const { result } = renderHook(() => usePreviewSync());

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      let loadedData: PreviewFormData | null = null;
      act(() => {
        loadedData = result.current.loadFromPreview();
      });

      expect(loadedData).toBeNull();
      consoleError.mockRestore();
    });

    it('should update lastSynced when loading data', () => {
      const storedData = {
        data: initialFormData,
        timestamp: Date.now() - 60000, // 1 minute ago
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(storedData));

      const { result } = renderHook(() => usePreviewSync());

      act(() => {
        result.current.loadFromPreview();
      });

      expect(result.current.lastSynced).toBeInstanceOf(Date);
    });
  });

  describe('clearPreview', () => {
    it('should remove data from localStorage', () => {
      const { result } = renderHook(() => usePreviewSync());

      act(() => {
        result.current.clearPreview();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should reset lastSynced to null', () => {
      const { result } = renderHook(() => usePreviewSync());

      act(() => {
        result.current.saveToPreview(initialFormData);
      });

      expect(result.current.lastSynced).not.toBeNull();

      act(() => {
        result.current.clearPreview();
      });

      expect(result.current.lastSynced).toBeNull();
    });
  });

  describe('hasPreviewData', () => {
    it('should return true when data exists in localStorage', () => {
      const storedData = {
        data: initialFormData,
        timestamp: Date.now(),
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedData));

      const { result } = renderHook(() => usePreviewSync());

      expect(result.current.hasPreviewData()).toBe(true);
    });

    it('should return false when no data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => usePreviewSync());

      expect(result.current.hasPreviewData()).toBe(false);
    });
  });

  describe('isLivePreview', () => {
    it('should be false by default', () => {
      const { result } = renderHook(() => usePreviewSync());

      expect(result.current.isLivePreview).toBe(false);
    });

    it('should be true when enableLivePreview is called', () => {
      const { result } = renderHook(() => usePreviewSync());

      act(() => {
        result.current.enableLivePreview();
      });

      expect(result.current.isLivePreview).toBe(true);
    });

    it('should be false after disableLivePreview is called', () => {
      const { result } = renderHook(() => usePreviewSync());

      act(() => {
        result.current.enableLivePreview();
      });

      expect(result.current.isLivePreview).toBe(true);

      act(() => {
        result.current.disableLivePreview();
      });

      expect(result.current.isLivePreview).toBe(false);
    });
  });

  describe('storage event listener', () => {
    it('should update data when storage event fires', async () => {
      const { result } = renderHook(() => usePreviewSync());

      const newData = {
        data: {
          ...initialFormData,
          appName: 'Updated App',
        },
        timestamp: Date.now(),
      };

      // Enable live preview mode
      act(() => {
        result.current.enableLivePreview();
      });

      // Simulate storage event from another tab
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(newData));

      await act(async () => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: JSON.stringify(newData),
          })
        );
      });

      // Check that the hook updates its internal state
      expect(result.current.lastSynced).toBeInstanceOf(Date);
    });

    it('should call onDataChange callback when storage changes', async () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(() => usePreviewSync({ onDataChange }));

      // Enable live preview mode
      act(() => {
        result.current.enableLivePreview();
      });

      const newData = {
        data: {
          ...initialFormData,
          appName: 'Callback App',
        },
        timestamp: Date.now(),
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(newData));

      await act(async () => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: JSON.stringify(newData),
          })
        );
      });

      expect(onDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: 'Callback App',
        })
      );
    });

    it('should not react to storage events when not in live preview mode', async () => {
      const onDataChange = vi.fn();

      renderHook(() => usePreviewSync({ onDataChange }));

      const newData = {
        data: initialFormData,
        timestamp: Date.now(),
      };

      await act(async () => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: JSON.stringify(newData),
          })
        );
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });

    it('should cleanup event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => usePreviewSync());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should ignore storage events for other keys', async () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(() => usePreviewSync({ onDataChange }));

      act(() => {
        result.current.enableLivePreview();
      });

      await act(async () => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'other_key',
            newValue: '{}',
          })
        );
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });
  });

  describe('debounced save', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce multiple rapid saves', async () => {
      const { result } = renderHook(() => usePreviewSync({ debounceMs: 500 }));

      // Make multiple rapid saves
      act(() => {
        result.current.saveToPreview({ ...initialFormData, appName: 'First' });
      });
      act(() => {
        result.current.saveToPreview({ ...initialFormData, appName: 'Second' });
      });
      act(() => {
        result.current.saveToPreview({ ...initialFormData, appName: 'Third' });
      });

      // Should not have saved yet
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();

      // Fast-forward debounce time
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should have saved only once with the last value
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData.data.appName).toBe('Third');
    });

    it('should save immediately when debounceMs is 0', () => {
      const { result } = renderHook(() => usePreviewSync({ debounceMs: 0 }));

      act(() => {
        result.current.saveToPreview({ ...initialFormData, appName: 'Immediate' });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPreviewAge', () => {
    it('should return null when no data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => usePreviewSync());

      expect(result.current.getPreviewAge()).toBeNull();
    });

    it('should return age in milliseconds', () => {
      const timestamp = Date.now() - 60000; // 1 minute ago
      const storedData = {
        data: initialFormData,
        timestamp,
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedData));

      const { result } = renderHook(() => usePreviewSync());

      const age = result.current.getPreviewAge();
      expect(age).toBeGreaterThanOrEqual(60000);
      expect(age).toBeLessThan(61000); // Allow 1 second tolerance
    });
  });

  describe('SSR safety', () => {
    it('should not throw when localStorage throws', () => {
      // Mock localStorage to throw (simulating SSR or storage disabled)
      const throwingStorage = {
        getItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        setItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        removeItem: vi.fn(() => {
          throw new Error('localStorage is not available');
        }),
        clear: vi.fn(),
      };

      Object.defineProperty(window, 'localStorage', {
        value: throwingStorage,
        writable: true,
        configurable: true,
      });

      expect(() => {
        renderHook(() => usePreviewSync());
      }).not.toThrow();

      // Restore mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });
    });
  });
});

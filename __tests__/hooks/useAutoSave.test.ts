import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoSave } from '@/hooks/useAutoSave';

describe('useAutoSave Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with idle status', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useAutoSave(saveFn, { data: 'test' }));

    expect(result.current.status).toBe('idle');
    expect(result.current.lastSaved).toBeNull();
  });

  it('should debounce save calls', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ data }) => useAutoSave(saveFn, data, { delay: 30000 }), {
      initialProps: { data: 'initial' },
    });

    // Change data multiple times quickly
    rerender({ data: 'update1' });
    rerender({ data: 'update2' });
    rerender({ data: 'update3' });

    // saveFn should not be called yet
    expect(saveFn).not.toHaveBeenCalled();

    // Fast-forward time by 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // saveFn should be called only once with the latest data
    await waitFor(() => {
      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(saveFn).toHaveBeenCalledWith('update3');
    });
  });

  it('should save after 30 seconds of inactivity by default', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ data }) => useAutoSave(saveFn, data), {
      initialProps: { data: 'initial' },
    });

    rerender({ data: 'updated' });

    // Fast-forward by 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(saveFn).toHaveBeenCalledWith('updated');
    });
  });

  it('should not save if data has not changed', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ data }) => useAutoSave(saveFn, data), {
      initialProps: { data: 'same' },
    });

    // Re-render with same data
    rerender({ data: 'same' });

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Should not save if data is unchanged
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('should handle save errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveFn = vi.fn().mockRejectedValue(new Error('Save failed'));

    const { result, rerender } = renderHook(({ data }) => useAutoSave(saveFn, data), {
      initialProps: { data: 'initial' },
    });

    rerender({ data: 'updated' });

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    consoleError.mockRestore();
  });

  it('should show saving status during save operation', async () => {
    const saveFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 1000);
        })
    );

    const { result, rerender } = renderHook(({ data }) => useAutoSave(saveFn, data), {
      initialProps: { data: 'initial' },
    });

    rerender({ data: 'updated' });

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Should be saving
    expect(result.current.status).toBe('saving');

    // Complete the save
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('saved');
    });
  });

  it('should update lastSaved timestamp after successful save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ data }) => useAutoSave(saveFn, data), {
      initialProps: { data: 'initial' },
    });

    expect(result.current.lastSaved).toBeNull();

    rerender({ data: 'updated' });

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(result.current.lastSaved).toBeInstanceOf(Date);
    });
  });

  it('should allow manual save trigger', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ data }) => useAutoSave(saveFn, data), {
      initialProps: { data: 'initial' },
    });

    rerender({ data: 'updated' });

    // Manually trigger save
    await act(async () => {
      await result.current.saveNow();
    });

    expect(saveFn).toHaveBeenCalledWith('updated');
  });

  it('should cancel pending save on unmount', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(({ data }) => useAutoSave(saveFn, data), {
      initialProps: { data: 'initial' },
    });

    rerender({ data: 'updated' });

    // Fast-forward halfway
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    // Unmount before save triggers
    unmount();

    // Fast-forward the rest
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    // Should not save after unmount
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('should support custom delay configuration', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const customDelay = 10000; // 10 seconds

    const { rerender } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, { delay: customDelay }),
      {
        initialProps: { data: 'initial' },
      }
    );

    rerender({ data: 'updated' });

    // Should not save at 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(saveFn).not.toHaveBeenCalled();

    // Should save at 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(saveFn).toHaveBeenCalledWith('updated');
    });
  });

  it('should allow disabling auto-save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ data }) => useAutoSave(saveFn, data, { enabled: false }), {
      initialProps: { data: 'initial' },
    });

    rerender({ data: 'updated' });

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Should not auto-save when disabled
    expect(saveFn).not.toHaveBeenCalled();
  });
});

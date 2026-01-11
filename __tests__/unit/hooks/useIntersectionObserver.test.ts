import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {}

  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = () => [];
}

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.IntersectionObserver = MockIntersectionObserver as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create IntersectionObserver with default options', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    const mockElement = document.createElement('div');

    // Trigger observer creation by setting ref
    result.current.ref(mockElement);

    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it('should create IntersectionObserver with custom options', () => {
    const { result } = renderHook(() =>
      useIntersectionObserver({
        threshold: 0.5,
        rootMargin: '100px',
      })
    );
    const mockElement = document.createElement('div');

    // Trigger observer creation by setting ref
    result.current.ref(mockElement);

    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it('should observe element when ref is set', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    const mockElement = document.createElement('div');

    result.current.ref(mockElement);

    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it('should return isIntersecting false initially', () => {
    const { result } = renderHook(() => useIntersectionObserver());

    expect(result.current.isIntersecting).toBe(false);
  });

  it('should cleanup on unmount', () => {
    const { result, unmount } = renderHook(() => useIntersectionObserver());
    const mockElement = document.createElement('div');

    result.current.ref(mockElement);
    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should handle null ref gracefully', () => {
    const { result } = renderHook(() => useIntersectionObserver());

    expect(() => result.current.ref(null)).not.toThrow();
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('should unobserve previous element when ref changes', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    const mockElement1 = document.createElement('div');
    const mockElement2 = document.createElement('div');

    result.current.ref(mockElement1);
    result.current.ref(mockElement2);

    expect(mockUnobserve).toHaveBeenCalledWith(mockElement1);
    expect(mockObserve).toHaveBeenCalledWith(mockElement2);
  });
});

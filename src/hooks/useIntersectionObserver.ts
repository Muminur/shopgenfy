import { useCallback, useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
}

interface UseIntersectionObserverReturn {
  ref: (node: Element | null) => void;
  isIntersecting: boolean;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const { threshold = 0.1, rootMargin = '50px', root = null } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<Element | null>(null);

  const ref = useCallback(
    (node: Element | null) => {
      // Cleanup previous observer
      if (elementRef.current && observerRef.current) {
        observerRef.current.unobserve(elementRef.current);
      }

      // Store new element
      elementRef.current = node;

      // Create new observer if element exists
      if (node) {
        if (!observerRef.current) {
          observerRef.current = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                setIsIntersecting(entry.isIntersecting);
              });
            },
            { threshold, rootMargin, root }
          );
        }

        observerRef.current.observe(node);
      }
    },
    [threshold, rootMargin, root]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { ref, isIntersecting };
}

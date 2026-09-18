import { useEffect, useState } from 'react';

/**
 * Debounces a fast-changing value such as a search box.
 *
 * Search inputs pass their raw value to `useSearchParams` immediately (so the URL
 * is shareable) but only the debounced copy reaches the API, which keeps typing
 * from firing a request per keystroke (Section 36).
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

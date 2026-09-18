import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filter state that lives in the URL.
 *
 * Keeping filters in the query string means a filtered search is shareable and
 * survives a refresh — and the browser back button undoes a filter change rather
 * than leaving the page.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Callers pass an object literal, so identity alone would invalidate `filters`
  // on every render and recompute query keys. The serialised shape is what
  // actually matters here.
  const defaultsKey = JSON.stringify(defaults);
  const stableDefaults = React.useMemo(() => JSON.parse(defaultsKey) as T, [defaultsKey]);

  const filters = React.useMemo<T>(() => {
    const next: Record<string, string> = { ...stableDefaults };
    for (const key of Object.keys(stableDefaults)) {
      const value = searchParams.get(key);
      if (value !== null && value !== '') next[key] = value;
    }
    return next as T;
  }, [searchParams, stableDefaults]);

  /** Any filter differing from its default counts as "narrowing the results". */
  const hasActiveFilters = React.useMemo(
    () => Object.keys(stableDefaults).some((key) => filters[key] !== stableDefaults[key]),
    [filters, stableDefaults],
  );

  const setFilters = React.useCallback(
    (patch: Partial<Record<keyof T, string | number | null>>, options: { resetPage?: boolean } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          // Any filter change invalidates the current page of results.
          if (options.resetPage !== false && 'page' in stableDefaults && !('page' in patch)) {
            next.delete('page');
          }
          return next;
        },
        // Filter changes should replace rather than stack history entries.
        { replace: true },
      );
    },
    [setSearchParams, stableDefaults],
  );

  const clearFilters = React.useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return { filters, setFilters, clearFilters, hasActiveFilters, searchParams };
}

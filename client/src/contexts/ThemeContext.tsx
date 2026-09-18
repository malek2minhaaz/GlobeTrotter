import * as React from 'react';
import type { ThemePreference } from '@/types/api';

/**
 * Theme (Section 42).
 *
 * The choice persists to `localStorage` so the inline script in `index.html` can
 * apply it before first paint, and it is also stored on the profile so a
 * traveller keeps their preference across devices. This provider owns applying
 * the theme; it deliberately does no fetching of its own.
 */

const STORAGE_KEY = 'globetrotter-theme';

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* Private browsing can throw on access — fall through to the default. */
  }
  return 'system';
}

function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

interface ThemeContextValue {
  /** What the traveller chose, including `system`. */
  theme: ThemePreference;
  /** What is actually on screen right now. */
  resolvedTheme: 'light' | 'dark';
  /** Applies a theme locally and persists it. */
  setTheme: (theme: ThemePreference) => void;
  /** Applies the server's stored preference and mirrors it into `localStorage`. */
  applyServerTheme: (theme: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePreference>(readStoredTheme);
  const [systemDark, setSystemDark] = React.useState(prefersDark);

  // Track the OS preference so `system` follows it live, not just at load.
  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    // Keeps native controls (scrollbars, date pickers) in the right scheme.
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const persistLocally = React.useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Non-fatal: the theme still applies for this session. */
    }
  }, []);

  const setTheme = React.useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      persistLocally(next);
    },
    [persistLocally],
  );

  /**
   * The profile is the source of truth across devices, but adopting it blindly on
   * every render would fight the traveller's in-session choice — so callers only
   * invoke this when the session first resolves.
   */
  const applyServerTheme = React.useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      persistLocally(next);
    },
    [persistLocally],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      applyServerTheme,
      toggle: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, resolvedTheme, setTheme, applyServerTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}

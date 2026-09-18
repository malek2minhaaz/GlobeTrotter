import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type LoginPayload, type RegisterPayload } from '@/services/auth.service';
import { queryKeys } from '@/lib/queryClient';
import { useTheme } from '@/contexts/ThemeContext';
import type { UserProfile } from '@/types/api';

/**
 * Session state (Section 44).
 *
 * The session is server state, so it lives in TanStack Query rather than a
 * bespoke global store: `/auth/me` is the single source of truth and login,
 * register and logout simply write to that cache. A 401 is treated as "signed
 * out" rather than an error, which keeps guarded routes simple.
 */

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  /** True only for the very first `/auth/me` check, before we know who you are. */
  isInitialising: boolean;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  register: (payload: RegisterPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  /** Re-reads the profile after a settings change. */
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { applyServerTheme } = useTheme();
  const adoptedThemeRef = React.useRef<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth,
    queryFn: authService.me,
    retry: false,
    staleTime: 5 * 60_000,
    // A 401 simply means "not signed in", so it must not be retried or surfaced.
    throwOnError: false,
  });

  const user = sessionQuery.data?.user ?? null;

  // Adopt the stored preference once per signed-in identity, so a device that has
  // never been used before picks up the traveller's choice.
  React.useEffect(() => {
    if (!user) {
      adoptedThemeRef.current = null;
      return;
    }
    if (adoptedThemeRef.current === user.id) return;
    adoptedThemeRef.current = user.id;
    applyServerTheme(user.preferences.theme);
  }, [user, applyServerTheme]);

  const loginMutation = useMutation({ mutationFn: authService.login });
  const registerMutation = useMutation({ mutationFn: authService.register });

  const landing = React.useCallback(
    (result: { user: UserProfile }) => {
      queryClient.setQueryData(queryKeys.auth, { user: result.user });
      // Everything cached for the previous session must not leak into this one.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      return result.user;
    },
    [queryClient],
  );

  const login = React.useCallback(
    async (payload: LoginPayload) => landing(await loginMutation.mutateAsync(payload)),
    [loginMutation, landing],
  );

  const register = React.useCallback(
    async (payload: RegisterPayload) => landing(await registerMutation.mutateAsync(payload)),
    [registerMutation, landing],
  );

  const logout = React.useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      // Clear regardless: a failed logout must still sign the traveller out here.
      queryClient.setQueryData(queryKeys.auth, null);
      queryClient.clear();
    }
  }, [queryClient]);

  const refresh = React.useCallback(async () => {
    await sessionQuery.refetch();
  }, [sessionQuery]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitialising: sessionQuery.isLoading,
      login,
      register,
      logout,
      refresh,
    }),
    [user, sessionQuery.isLoading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

/** Convenience for screens that are only reachable when signed in. */
export function useCurrentUser(): UserProfile {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}

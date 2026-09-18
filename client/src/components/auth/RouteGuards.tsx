import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingPanel } from '@/components/ui/feedback';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Route protection (Section 8).
 *
 * The session check is asynchronous, so guards wait for it rather than bouncing
 * a signed-in traveller to the login page on a hard refresh.
 */

/** Requires a session; otherwise sends the visitor to login and remembers where. */
export function ProtectedRoute() {
  const { isAuthenticated, isInitialising } = useAuth();
  const location = useLocation();

  if (isInitialising) {
    return <LoadingPanel label="Checking your session…" className="min-h-dvh" />;
  }

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <Outlet />;
}

/** Keeps signed-in travellers away from the login and signup screens. */
export function PublicOnlyRoute() {
  const { isAuthenticated, isInitialising } = useAuth();
  const location = useLocation();

  if (isInitialising) {
    return <LoadingPanel label="Loading GlobeTrotter…" className="min-h-dvh" />;
  }

  if (isAuthenticated) {
    const redirect = new URLSearchParams(location.search).get('redirect');
    return <Navigate to={redirect && redirect.startsWith('/') ? redirect : '/dashboard'} replace />;
  }

  return <Outlet />;
}

/** Admin-only area, e.g. the analytics dashboard (Section 25). */
export function AdminRoute() {
  const { user, isAuthenticated, isInitialising } = useAuth();

  if (isInitialising) {
    return <LoadingPanel label="Checking your access…" className="min-h-dvh" />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}

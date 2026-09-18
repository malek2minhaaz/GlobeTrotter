import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Lock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RouteMeta } from '@/components/common/RouteMeta';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Unauthorized (Section 31).
 *
 * Reached when a signed-in traveller opens something that is not theirs — an
 * admin page, or a trip belonging to another account.
 */
export default function UnauthorizedPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <RouteMeta title="Not allowed" description="You do not have access to that page." />

      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-24 text-center sm:px-6">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <Lock className="size-7 text-destructive" aria-hidden="true" />
        </span>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            You do not have access to that
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {isAuthenticated
              ? `Signed in as ${user?.email}. This page needs different permissions, or belongs to another traveller's account.`
              : 'Please sign in to continue. If you followed a private link, ask the owner to share it again.'}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {isAuthenticated ? (
            <>
              <Button asChild>
                <Link to="/dashboard">
                  <Home />
                  Go to dashboard
                </Link>
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft />
                Go back
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link to="/login">
                  <LogIn />
                  Sign in
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/discover">Explore destinations</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

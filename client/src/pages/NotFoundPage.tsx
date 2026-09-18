import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Compass, Home, LayoutDashboard, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { RouteMeta } from '@/components/common/RouteMeta';
import { CityTile } from '@/components/city/CityCard';
import { queryKeys } from '@/lib/queryClient';
import { discoveryService } from '@/services/discovery.service';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 404 (Section 47).
 *
 * Kept in the travel voice and, more usefully, offers real ways forward rather
 * than a bare apology.
 */
export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  const popularQuery = useQuery({
    queryKey: queryKeys.popularCities,
    queryFn: () => discoveryService.popularCities(6),
    staleTime: 5 * 60_000,
  });

  const popular = popularQuery.data ?? [];

  return (
    <>
      <RouteMeta
        title="Page not found"
        description="That page does not exist. Explore destinations instead."
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 py-20 text-center sm:px-6">
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl"
          />
          <span className="relative flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground shadow-lg">
            <Compass className="size-10" aria-hidden="true" />
          </span>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            404 — off the map
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Looks like you&apos;ve taken a wrong turn.
          </h1>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground">
            The page you were looking for is not here. It may have been moved, or the link may be
            incomplete. Let us get you back on route.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={isAuthenticated ? '/dashboard' : '/'}>
              {isAuthenticated ? <LayoutDashboard /> : <Home />}
              Back to GlobeTrotter
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/discover">
              <Navigation />
              Explore destinations
            </Link>
          </Button>
        </div>

        <section className="w-full space-y-4 pt-6">
          <h2 className="flex items-center justify-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-primary" aria-hidden="true" />
            While you are here — popular right now
          </h2>
          {popularQuery.isLoading ? (
            <div className="rail justify-center">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-52 w-64 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="rail justify-start pb-2 sm:justify-center">
              {popular.map((city) => (
                <CityTile key={city.id} city={city} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

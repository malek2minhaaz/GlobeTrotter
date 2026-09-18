import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  Copy,
  Globe2,
  Link2,
  List,
  MapPin,
  Route,
  Share2,
  Sparkles,
  Ticket,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingPanel } from '@/components/ui/feedback';
import { Separator, UserAvatar } from '@/components/ui/misc';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/tooltip-checkbox';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SmartImage } from '@/components/common/SmartImage';
import { ReadOnlyItinerary, itineraryTotal } from '@/components/trip/ReadOnlyItinerary';
import { shareService } from '@/services/trips.service';
import { useAuth } from '@/contexts/AuthContext';
import { useTripMutations } from '@/hooks/useTripMutations';
import { formatCurrency, formatDateRange, pluralise } from '@/lib/format';

/**
 * Public itinerary (Sections 20 and 21).
 *
 * Reachable without an account and never exposes anything private: the owner is
 * shown by name and avatar only, and the copy action is the single mutation a
 * visitor can perform — and only once signed in.
 */
export default function SharedTripPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { copyTrip } = useTripMutations();
  const [mode, setMode] = React.useState<'list' | 'timeline'>('list');
  const [copied, setCopied] = React.useState(false);

  const sharedQuery = useQuery({
    queryKey: ['shared', slug],
    queryFn: () => shareService.get(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const trip = sharedQuery.data?.trip;

  const shareUrl = typeof window === 'undefined' ? '' : window.location.href;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard can be blocked; the URL is visible in the address bar anyway. */
    }
  };

  const webShare = async () => {
    if (!trip || typeof navigator.share !== 'function') {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: trip.name,
        text: `Take a look at this itinerary: ${trip.name}`,
        url: shareUrl,
      });
    } catch {
      /* A cancelled share sheet is not an error. */
    }
  };

  const handleCopyTrip = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/shared/${slug}`)}`);
      return;
    }
    const result = await copyTrip.mutateAsync(slug);
    navigate(`/trips/${result.trip.id}`, { replace: true });
  };

  if (sharedQuery.isLoading) {
    return <LoadingPanel label="Loading this itinerary…" className="min-h-[60dvh]" />;
  }

  if (sharedQuery.isError || !trip) {
    return (
      <>
        <RouteMeta title="Itinerary not available" />
        <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
          <EmptyState
            icon={Link2}
            title="This itinerary is not available"
            description="The link may be incomplete, or the owner has turned sharing off. Try asking them to share it again."
            action={
              <Button asChild>
                <Link to="/discover">Explore destinations instead</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const activityTotal = itineraryTotal(trip);
  const currency = 'INR';

  return (
    <>
      <RouteMeta
        title={trip.name}
        description={`${pluralise(trip.cityCount, 'city', 'cities')} · ${pluralise(trip.durationDays, 'day')} · shared on GlobeTrotter`}
        image={trip.coverImage}
        type="article"
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-2xl border border-border shadow-sm">
          <div className="relative h-72 sm:h-80">
            <SmartImage
              src={trip.coverImage}
              alt=""
              decorative
              seed={trip.name}
              className="size-full"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />

            <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3 sm:inset-x-6">
              <Badge variant="solid">
                <Globe2 aria-hidden="true" />
                Shared itinerary
              </Badge>
              <p className="text-xs text-white/80">{trip.viewCount} views</p>
            </div>

            <div className="absolute inset-x-4 bottom-5 space-y-3 text-white sm:inset-x-6">
              <h1 className="text-3xl font-semibold drop-shadow-sm sm:text-4xl">{trip.name}</h1>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {formatDateRange(trip.startDate, trip.endDate)} ·{' '}
                  {pluralise(trip.durationDays, 'day')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {pluralise(trip.cityCount, 'city', 'cities')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ticket className="size-3.5" aria-hidden="true" />
                  {pluralise(trip.activityCount, 'activity', 'activities')}
                </span>
                {trip.owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <UserAvatar
                      name={trip.owner.name}
                      src={trip.owner.avatar}
                      className="size-5 border-0"
                    />
                    by {trip.owner.name}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void handleCopyTrip()} loading={copyTrip.isPending}>
                <Copy />
                Copy This Trip
              </Button>
              <Button variant="outline" onClick={() => void copyLink()}>
                {copied ? <Check className="text-success" /> : <Link2 />}
                {copied ? 'Link copied' : 'Copy Link'}
              </Button>
              <Button variant="outline" onClick={() => void webShare()}>
                <Share2 />
                Share
              </Button>
            </div>
            {!isAuthenticated ? (
              <p className="text-xs text-muted-foreground">
                Sign in free to copy this itinerary into your own trips.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Copying makes a private copy you can edit — the original stays untouched.
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          {/* ── Itinerary ── */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Itinerary</h2>
                <p className="text-xs text-muted-foreground">
                  Day-by-day plan across {pluralise(trip.cityCount, 'city', 'cities')}
                </p>
              </div>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(value) => value && setMode(value as 'list' | 'timeline')}
                aria-label="Itinerary view mode"
              >
                <ToggleGroupItem value="list" aria-label="List view">
                  <List />
                  List
                </ToggleGroupItem>
                <ToggleGroupItem value="timeline" aria-label="Timeline view">
                  <Route />
                  Timeline
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <ReadOnlyItinerary trip={trip} mode={mode} currency={currency} />
          </section>

          {/* ── Aside ── */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Estimated budget</h2>
              <p className="text-2xl font-semibold tracking-tight">
                {formatCurrency(activityTotal, currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                Activity estimates only. The original trip may include accommodation and transport
                that is not shown publicly.
              </p>
              <Separator />
              <dl className="space-y-2 text-sm">
                <Row
                  label="Average per day"
                  value={formatCurrency(
                    trip.durationDays > 0 ? activityTotal / trip.durationDays : 0,
                    currency,
                  )}
                />
                <Row label="Cities" value={String(trip.cityCount)} />
                <Row label="Activities" value={String(trip.activityCount)} />
              </dl>
            </section>

            {trip.description ? (
              <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold">About this trip</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {trip.description}
                </p>
              </section>
            ) : null}

            <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                Plan your own
              </h2>
              <p className="text-xs text-muted-foreground">
                Copy this trip as a starting point, or build one from scratch with your own cities
                and dates.
              </p>
              <div className="grid gap-2">
                <Button className="w-full" onClick={() => void handleCopyTrip()} loading={copyTrip.isPending}>
                  <Copy />
                  Copy This Trip
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/trips/create">Plan a new trip</Link>
                </Button>
              </div>
            </section>

            <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Wallet className="size-3.5" aria-hidden="true" />
                Prices are planning estimates and vary by season.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

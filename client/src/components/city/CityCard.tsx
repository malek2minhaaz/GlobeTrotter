import { Link } from 'react-router-dom';
import { ArrowRight, Flame, MapPin, Plus, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SmartImage } from '@/components/common/SmartImage';
import { SaveCityButton } from './SaveCityButton';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import type { City } from '@/types/api';

/** Cost bands, so the index reads as guidance rather than a bare number. */
export function costBand(costIndex: number): { label: string; tone: 'success' | 'warning' | 'destructive' } {
  if (costIndex <= 2) return { label: 'Budget-friendly', tone: 'success' };
  if (costIndex <= 3) return { label: 'Mid-range', tone: 'warning' };
  return { label: 'Premium', tone: 'destructive' };
}

export function CityCard({
  city,
  onAddToTrip,
  className,
}: {
  city: City;
  onAddToTrip?: (city: City) => void;
  className?: string;
}) {
  const currency = useCurrency();
  const band = costBand(city.costIndex);

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Link to={`/city/${city.id}`} tabIndex={-1} aria-hidden="true">
          <SmartImage
            src={city.image}
            alt=""
            decorative
            seed={`${city.name} ${city.country}`}
            className="size-full transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute right-3 top-3">
          <SaveCityButton cityId={city.id} isSaved={Boolean(city.isSaved)} cityName={city.name} />
        </div>
        <div className="absolute bottom-3 left-3 space-y-0.5">
          <h3 className="text-base font-semibold text-white drop-shadow-sm">
            <Link to={`/city/${city.id}`} className="hover:underline">
              {city.name}
            </Link>
          </h3>
          <p className="flex items-center gap-1 text-xs text-white/85">
            <MapPin className="size-3" aria-hidden="true" />
            {city.country}
            {city.region ? ` · ${city.region}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{city.description}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={band.tone}>{band.label}</Badge>
          <Badge variant="outline">
            <TrendingUp aria-hidden="true" />
            Cost {city.costIndex.toFixed(1)}
          </Badge>
          {city.popularity >= 80 ? (
            <Badge variant="accent">
              <Flame aria-hidden="true" />
              Popular
            </Badge>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          About{' '}
          <span className="font-medium text-foreground">
            {formatCurrency(city.estimatedDailyCost, currency)}
          </span>{' '}
          per day
        </p>

        <div className="mt-auto flex gap-2 pt-1">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to={`/city/${city.id}`}>
              View details
              <ArrowRight />
            </Link>
          </Button>
          {onAddToTrip ? (
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={() => onAddToTrip(city)}
              aria-label={`Add ${city.name} to a trip`}
            >
              <Plus />
              Add to trip
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Condensed city tile for horizontal rails on the landing and dashboard. */
export function CityTile({ city, className }: { city: City; className?: string }) {
  return (
    <Link
      to={`/city/${city.id}`}
      className={cn(
        'group relative block h-52 w-64 shrink-0 overflow-hidden rounded-xl border border-border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
        className,
      )}
    >
      <SmartImage
        src={city.image}
        alt=""
        decorative
        seed={`${city.name} ${city.country}`}
        className="size-full transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      <div className="absolute inset-x-4 bottom-4 space-y-1 text-white">
        <p className="text-base font-semibold drop-shadow-sm">{city.name}</p>
        <p className="flex items-center gap-1 text-xs text-white/85">
          <MapPin className="size-3" aria-hidden="true" />
          {city.country}
        </p>
        <p className="pt-1 text-xs text-white/80">
          From {formatCurrency(city.estimatedDailyCost, 'INR')} / day
        </p>
      </div>
    </Link>
  );
}

/** Small pill listing a city, used in trip summaries and the itinerary sidebar. */
export function CityPill({ name, country }: { name: string; country: string }) {
  return (
    <Badge variant="secondary" className="max-w-full">
      <MapPin aria-hidden="true" />
      <span className="truncate">
        {name}
        {country ? `, ${country}` : ''}
      </span>
    </Badge>
  );
}

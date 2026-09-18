import * as React from 'react';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlay';
import { SmartImage } from '@/components/common/SmartImage';
import { CitySearchPicker } from '@/components/city/CitySearchPicker';
import { addDaysISO, dayCount, formatDateRange, pluralise } from '@/lib/format';
import type { City } from '@/types/api';

/**
 * Add a destination to an existing trip (Section 13).
 *
 * The suggested window follows the last stay, so a trip built up over several
 * sessions stays in chronological order without the traveller doing the maths.
 */
export function AddCityDialog({
  open,
  onOpenChange,
  tripStart,
  tripEnd,
  existingCityIds,
  lastStayEnd,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripStart: string;
  tripEnd: string;
  existingCityIds: string[];
  /** End date of the final stay, used to suggest where the new one begins. */
  lastStayEnd: string | null;
  onSubmit: (values: { city: City; startDate: string; endDate: string }) => void;
  saving: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const [city, setCity] = React.useState<City | null>(null);
  const [startDate, setStartDate] = React.useState(tripStart);
  const [endDate, setEndDate] = React.useState(tripStart);

  const suggestedStart = React.useMemo(() => {
    if (!lastStayEnd) return tripStart;
    const after = addDaysISO(lastStayEnd, 1);
    if (after > tripStart) return after > tripEnd ? tripEnd : after;
    return tripStart;
  }, [lastStayEnd, tripStart, tripEnd]);

  // Reset the form each time the dialog opens so a previous choice never lingers.
  React.useEffect(() => {
    if (!open) return;
    setCity(null);
    setQuery('');
    setStartDate(suggestedStart);
    setEndDate(suggestedStart === tripEnd ? tripEnd : addDaysISO(suggestedStart, 2));
  }, [open, suggestedStart, tripEnd]);

  const rangeInvalid = endDate < startDate;
  const outsideTrip = startDate < tripStart || endDate > tripEnd;

  const handleSubmit = () => {
    if (!city || rangeInvalid || outsideTrip) return;
    onSubmit({ city, startDate, endDate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a destination</DialogTitle>
          <DialogDescription>
            Pick a city and set how long you are staying. Stays must sit inside your trip dates ({' '}
            {formatDateRange(tripStart, tripEnd)}).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-80">
            <CitySearchPicker
              query={query}
              onQueryChange={setQuery}
              selectedIds={existingCityIds}
              onSelect={(next) => {
                setCity(next);
                setStartDate(suggestedStart);
                setEndDate(suggestedStart === tripEnd ? tripEnd : addDaysISO(suggestedStart, 2));
              }}
            />
          </div>

          <div className="space-y-3">
            {city ? (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
                  <SmartImage
                    src={city.image}
                    alt=""
                    decorative
                    seed={`${city.name} ${city.country}`}
                    className="size-12 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{city.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {city.country} · cost index {city.costIndex.toFixed(1)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="add-city-start">Arrive</Label>
                  <Input
                    id="add-city-start"
                    type="date"
                    min={tripStart}
                    max={tripEnd}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="add-city-end">Leave</Label>
                  <Input
                    id="add-city-end"
                    type="date"
                    min={startDate}
                    max={tripEnd}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>

                <FieldError>
                  {rangeInvalid
                    ? 'The leave date cannot be before the arrive date.'
                    : outsideTrip
                      ? 'The stay must fit inside your trip dates.'
                      : undefined}
                </FieldError>

                <Badge variant="secondary">
                  <MapPin aria-hidden="true" />
                  {pluralise(dayCount(startDate, endDate), 'day')} in {city.name}
                </Badge>

                <FieldHint>
                  Staying after {lastStayEnd ? formatDateRange(lastStayEnd, lastStayEnd) : 'the start'}{' '}
                  keeps your route in order.
                </FieldHint>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
                <MapPin className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">No city selected</p>
                <p className="text-xs text-muted-foreground">
                  Choose a destination from the search to set your stay.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!city || rangeInvalid || outsideTrip}
            onClick={handleSubmit}
          >
            Add to trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

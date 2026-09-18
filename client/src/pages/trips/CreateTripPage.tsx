import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Globe2,
  Lock,
  MapPin,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/feedback';
import { Separator, SwitchRow } from '@/components/ui/misc';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { Stepper, type StepDefinition } from '@/components/common/Stepper';
import { ImagePicker } from '@/components/common/ImagePicker';
import { SmartImage } from '@/components/common/SmartImage';
import { CitySearchPicker } from '@/components/city/CitySearchPicker';
import { ActivityPicker } from '@/components/activity/ActivityPicker';
import { queryKeys } from '@/lib/queryClient';
import { tripsService } from '@/services/trips.service';
import { discoveryService } from '@/services/discovery.service';
import { toast } from '@/lib/toast';
import { applyApiFieldErrors } from '@/lib/formErrors';
import {
  activitiesCost,
  clampStays,
  daysBetween,
  nextSlot,
  nextStayWindow,
  referenceStayCost,
  stayLabel,
} from '@/lib/wizard';
import {
  addDaysISO,
  dayCount,
  formatCurrency,
  formatDateRange,
  formatDuration,
  formatTime,
  pluralise,
  todayISODate,
} from '@/lib/format';
import { tripDetailsSchema, type TripDetailsForm } from '@/lib/schemas';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import type { Activity, City } from '@/types/api';

/**
 * Create trip wizard (Section 10).
 *
 * The whole trip is composed locally and written once, at the end: details first,
 * then destinations, an optional first pass at the itinerary, an optional budget,
 * and a review. Writes happen in two steps because itinerary items need the stop
 * ids the server only issues after the trip exists.
 */

const STEPS: StepDefinition[] = [
  { id: 'details', label: 'Trip details', description: 'Name, dates, cover' },
  { id: 'cities', label: 'Destinations', description: 'Where you are going' },
  { id: 'itinerary', label: 'Itinerary', description: 'Things to do' },
  { id: 'budget', label: 'Budget', description: 'Optional limit' },
  { id: 'review', label: 'Review', description: 'Confirm and create' },
];

interface DraftStay {
  key: string;
  city: City;
  startDate: string;
  endDate: string;
}

interface DraftActivity {
  key: string;
  activity: Activity;
  cityId: string;
  date: string;
  startTime: string;
  endTime: string | null;
}

export default function CreateTripPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const currency = useCurrency();
  const preselectCityId = searchParams.get('city');

  const [step, setStep] = React.useState(0);
  const [stays, setStays] = React.useState<DraftStay[]>([]);
  const [activities, setActivities] = React.useState<DraftActivity[]>([]);
  const [budgetLimit, setBudgetLimit] = React.useState('');
  const [cityQuery, setCityQuery] = React.useState('');
  const [activeStayKey, setActiveStayKey] = React.useState<string | null>(null);
  const [activeDay, setActiveDay] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const [stepError, setStepError] = React.useState<string | null>(null);

  const form = useForm<TripDetailsForm>({
    resolver: zodResolver(tripDetailsSchema),
    defaultValues: {
      name: '',
      description: '',
      coverImage: '',
      startDate: todayISODate(),
      endDate: addDaysISO(todayISODate(), 6),
      isPublic: false,
    },
  });

  const { watch, setValue, handleSubmit, trigger } = form;
  // Optional fields come back as `string | undefined` from the resolver, but the
  // form controls below want a concrete string.
  const coverImage = watch('coverImage') ?? '';
  const tripName = watch('name');
  const isPublic = watch('isPublic');
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  const draftStays = React.useMemo(
    () => stays.map(({ city, startDate: from, endDate: to }) => ({ city, startDate: from, endDate: to })),
    [stays],
  );

  // Deep-linked from a city card: drop that destination straight into the plan.
  const preselectedQuery = useQuery({
    queryKey: queryKeys.city(preselectCityId ?? 'none'),
    queryFn: () => discoveryService.city(preselectCityId!),
    enabled: Boolean(preselectCityId),
    staleTime: 5 * 60_000,
  });

  // Applied exactly once: re-running on every date change would silently undo a
  // traveller removing the city they arrived here with.
  const appliedPreselectRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const city = preselectedQuery.data?.city;
    if (!city || appliedPreselectRef.current === city.id) return;
    appliedPreselectRef.current = city.id;
    setStays((current) => {
      if (current.some((stay) => stay.city.id === city.id)) return current;
      return [...current, { key: city.id, city, ...nextStayWindow(current, startDate, endDate) }];
    });
  }, [preselectedQuery.data, startDate, endDate]);

  // Trip dates are the outer boundary, so changing them re-clamps every stay.
  React.useEffect(() => {
    setStays((current) => clampStays(current, startDate, endDate));
    setActivities((current) =>
      current.filter((item) => item.date >= startDate && item.date <= endDate),
    );
  }, [startDate, endDate]);

  const addCity = (city: City) => {
    setStays((current) => {
      if (current.some((stay) => stay.city.id === city.id)) return current;
      const window = nextStayWindow(current, startDate, endDate);
      return [...current, { key: city.id, city, ...window }];
    });
    setStepError(null);
  };

  const updateStay = (key: string, patch: Partial<Pick<DraftStay, 'startDate' | 'endDate'>>) => {
    setStays((current) =>
      clampStays(
        current.map((stay) => (stay.key === key ? { ...stay, ...patch } : stay)),
        startDate,
        endDate,
      ),
    );
  };

  const removeStay = (key: string) => {
    const stay = stays.find((entry) => entry.key === key);
    setStays((current) => clampStays(current.filter((entry) => entry.key !== key), startDate, endDate));
    if (stay) setActivities((current) => current.filter((item) => item.cityId !== stay.city.id));
    if (activeStayKey === key) setActiveStayKey(null);
  };

  const addActivity = (cityId: string, activity: Activity, date: string) => {
    const existing = activities.filter((item) => item.date === date);
    const slot = nextSlot(
      existing.map((item) => ({ startTime: item.startTime, duration: item.activity.duration })),
      activity,
    );
    setActivities((current) => [
      ...current,
      {
        key: `${activity.id}-${date}-${current.length}`,
        activity,
        cityId,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    ]);
  };

  const removeActivity = (key: string) =>
    setActivities((current) => current.filter((item) => item.key !== key));

  const activityTotal = activitiesCost(activities);
  const stayReferenceTotal = referenceStayCost(
    draftStays.map((stay) => ({
      estimatedDailyCost: stay.city.estimatedDailyCost,
      startDate: stay.startDate,
      endDate: stay.endDate,
    })),
  );
  const referenceTotal = activityTotal + stayReferenceTotal;
  const budgetNumber = budgetLimit === '' ? null : Number(budgetLimit);
  const overBudget = budgetNumber !== null && referenceTotal > budgetNumber;

  // ── Navigation ──

  const goNext = async () => {
    setStepError(null);

    if (step === 0) {
      const valid = await trigger();
      if (!valid) {
        setStepError('Please fix the highlighted fields before continuing.');
        return;
      }
    }

    if (step === 1 && stays.length === 0) {
      setStepError('Add at least one destination so we can build your itinerary around it.');
      return;
    }

    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const onSubmit = handleSubmit(async (details) => {
    setSubmitting(true);
    setStepError(null);
    try {
      setProgress('Creating your trip…');
      const { trip } = await tripsService.create({
        name: details.name,
        description: details.description || null,
        coverImage: details.coverImage || null,
        startDate: details.startDate,
        endDate: details.endDate,
        isPublic: details.isPublic,
        budgetLimit: budgetNumber,
        stops: stays.map((stay) => ({
          cityId: stay.city.id,
          startDate: stay.startDate,
          endDate: stay.endDate,
        })),
      });

      if (activities.length > 0) {
        setProgress(`Adding ${pluralise(activities.length, 'activity', 'activities')}…`);
        const stopByCity = new Map(trip.stops.map((stop) => [stop.cityId, stop.id]));

        // The traveller composed this schedule deliberately, so overlaps are
        // accepted rather than rejected mid-create.
        await Promise.all(
          activities.map((item) =>
            tripsService.addItineraryItem(trip.id, {
              activityId: item.activity.id,
              date: item.date,
              startTime: item.startTime,
              endTime: item.endTime,
              tripStopId: stopByCity.get(item.cityId) ?? null,
              allowOverlap: true,
            }),
          ),
        );
      }

      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });

      toast.success('Trip created', 'Your itinerary is ready to refine.');
      navigate(`/trips/${trip.id}`, { replace: true });
    } catch (error) {
      const handled = applyApiFieldErrors(form.setError, error, ['name', 'startDate', 'endDate']);
      setStepError(
        handled ? 'Please fix the highlighted fields.' : 'We could not create your trip. Please try again.',
      );
      if (!handled) toast.fromError(error, 'We could not create your trip.');
      setProgress('');
    } finally {
      setSubmitting(false);
    }
  });

  const activeStay = stays.find((stay) => stay.key === activeStayKey) ?? stays[0] ?? null;

  // Keep the day selection valid when the active city changes.
  React.useEffect(() => {
    if (!activeStay) {
      setActiveDay(null);
      return;
    }
    const days = daysBetween(activeStay.startDate, activeStay.endDate);
    if (!activeDay || !days.includes(activeDay)) setActiveDay(days[0] ?? null);
  }, [activeStay, activeDay]);

  return (
    <>
      <RouteMeta
        title="Plan a new trip"
        description="Create a multi-city trip with destinations, activities and a budget in one wizard."
      />

      <div className="space-y-6">
        <PageHeader
          eyebrow="New trip"
          title="Plan a new trip"
          description="Four quick steps and you will have a multi-city itinerary with a cost estimate."
          actions={
            <Button asChild variant="ghost">
              <Link to="/trips">
                <ArrowLeft />
                Cancel
              </Link>
            </Button>
          }
        />

        <Stepper
          steps={STEPS}
          currentIndex={step}
          onStepClick={(index) => {
            setStepError(null);
            setStep(index);
          }}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              {step === 0 ? (
                <StepDetails
                  register={form.register}
                  errors={form.formState.errors}
                  coverImage={coverImage}
                  tripName={tripName}
                  isPublic={isPublic}
                  onCoverChange={(value) => setValue('coverImage', value, { shouldDirty: true })}
                  onPublicChange={(value) => setValue('isPublic', value)}
                />
              ) : null}

              {step === 1 ? (
                <StepDestinations
                  query={cityQuery}
                  onQueryChange={setCityQuery}
                  stays={stays}
                  startDate={startDate}
                  endDate={endDate}
                  onSelect={addCity}
                  onUpdate={updateStay}
                  onRemove={removeStay}
                  error={stepError}
                />
              ) : null}

              {step === 2 ? (
                <StepItinerary
                  stays={stays}
                  activities={activities}
                  activeStay={activeStay}
                  activeDay={activeDay}
                  onSelectStay={(key) => setActiveStayKey(key)}
                  onSelectDay={setActiveDay}
                  onAdd={addActivity}
                  onRemove={removeActivity}
                  onContinue={() => setStep(3)}
                />
              ) : null}

              {step === 3 ? (
                <StepBudget
                  budgetLimit={budgetLimit}
                  onBudgetChange={setBudgetLimit}
                  activityTotal={activityTotal}
                  stayTotal={stayReferenceTotal}
                  referenceTotal={referenceTotal}
                  overBudget={overBudget}
                  currency={currency}
                  stays={draftStays}
                />
              ) : null}

              {step === 4 ? (
                <StepReview
                  name={tripName}
                  coverImage={coverImage}
                  description={watch('description') ?? ''}
                  startDate={startDate}
                  endDate={endDate}
                  isPublic={isPublic}
                  stays={draftStays}
                  activities={activities}
                  budgetLimit={budgetNumber}
                  referenceTotal={referenceTotal}
                  currency={currency}
                  onEditStep={setStep}
                />
              ) : null}
            </div>

            {stepError ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {stepError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
                <ArrowLeft />
                Back
              </Button>

              <div className="flex items-center gap-3">
                {progress ? <span className="text-sm text-muted-foreground">{progress}</span> : null}
                {step < STEPS.length - 1 ? (
                  <Button type="button" onClick={() => void goNext()}>
                    Continue
                    <ArrowRight />
                  </Button>
                ) : (
                  <Button type="submit" size="lg" loading={submitting} disabled={stays.length === 0}>
                    <Sparkles />
                    Create My Trip
                  </Button>
                )}
              </div>
            </div>
          </form>

          {/* ── Live summary ── */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Trip at a glance</h2>
              <SummaryRow label="Trip name" value={tripName || 'Untitled trip'} />
              <SummaryRow label="Dates" value={formatDateRange(startDate, endDate)} />
              <SummaryRow
                label="Duration"
                value={pluralise(dayCount(startDate, endDate), 'day')}
              />
              <SummaryRow label="Destinations" value={String(stays.length)} />
              <SummaryRow label="Activities" value={String(activities.length)} />
              <Separator />
              <SummaryRow
                label="Activity cost"
                value={formatCurrency(activityTotal, currency)}
              />
              <SummaryRow
                label="Stay reference"
                value={formatCurrency(stayReferenceTotal, currency)}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Reference total</span>
                <span className="text-sm font-semibold text-primary">
                  {formatCurrency(referenceTotal, currency)}
                </span>
              </div>
              {budgetNumber !== null ? (
                <Badge variant={overBudget ? 'destructive' : 'success'} className="w-full justify-center">
                  <Wallet aria-hidden="true" />
                  {overBudget
                    ? `${formatCurrency(referenceTotal - budgetNumber, currency)} over your limit`
                    : `${formatCurrency(budgetNumber - referenceTotal, currency)} within your limit`}
                </Badge>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                Estimates use each destination&apos;s daily cost and the activities you pick. The
                budget page recalculates everything once the trip exists.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

// ── Step 1: details ──────────────────────────────────────────────────────────

function StepDetails({
  register,
  errors,
  coverImage,
  tripName,
  isPublic,
  onCoverChange,
  onPublicChange,
}: {
  register: ReturnType<typeof useForm<TripDetailsForm>>['register'];
  errors: ReturnType<typeof useForm<TripDetailsForm>>['formState']['errors'];
  coverImage: string;
  tripName: string;
  isPublic: boolean;
  onCoverChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Trip information</h2>
        <p className="text-sm text-muted-foreground">
          Give your trip a name and set the dates everything else will be planned around.
        </p>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="name">Trip name</Label>
        <Input
          id="name"
          placeholder="Rajasthan road trip"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'name-error' : undefined}
          {...register('name')}
        />
        <FieldError id="name-error">{errors.name?.message}</FieldError>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            type="date"
            aria-invalid={errors.startDate ? true : undefined}
            {...register('startDate')}
          />
          <FieldError>{errors.startDate?.message}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End date</Label>
          <Input
            id="endDate"
            type="date"
            aria-invalid={errors.endDate ? true : undefined}
            {...register('endDate')}
          />
          <FieldError>{errors.endDate?.message}</FieldError>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Palaces, markets and one very long train ride."
          {...register('description')}
        />
        <FieldHint>Optional — a line or two helps when you look back on the trip.</FieldHint>
      </div>

      <ImagePicker
        id="coverImage"
        label="Cover image"
        value={coverImage}
        onChange={onCoverChange}
        seed={tripName || 'GlobeTrotter'}
        error={errors.coverImage?.message}
      />

      <Separator />

      <SwitchRow
        id="isPublic"
        label="Make this trip public"
        description="Public trips get a share link anyone can view. You can change this at any time."
        checked={isPublic}
        onCheckedChange={onPublicChange}
      />
    </div>
  );
}

// ── Step 2: destinations ─────────────────────────────────────────────────────

function StepDestinations({
  query,
  onQueryChange,
  stays,
  startDate,
  endDate,
  onSelect,
  onUpdate,
  onRemove,
  error,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  stays: DraftStay[];
  startDate: string;
  endDate: string;
  onSelect: (city: City) => void;
  onUpdate: (key: string, patch: Partial<Pick<DraftStay, 'startDate' | 'endDate'>>) => void;
  onRemove: (key: string) => void;
  error: string | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">Choose destinations</h2>
          <p className="text-sm text-muted-foreground">
            Search the catalogue and add as many cities as your dates allow.
          </p>
        </header>
        <div className="h-[28rem]">
          <CitySearchPicker
            query={query}
            onQueryChange={onQueryChange}
            selectedIds={stays.map((stay) => stay.city.id)}
            onSelect={onSelect}
          />
        </div>
      </div>

      <div className="space-y-4">
        <header className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Your route</h3>
          <Badge variant={stays.length === 0 ? 'outline' : 'default'}>
            {pluralise(stays.length, 'city', 'cities')}
          </Badge>
        </header>

        {stays.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No destinations yet"
            description="Add a city from the search on the left. We will give you a sensible stay length you can adjust."
            className="py-10"
          />
        ) : (
          <ol className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {stays.map((stay, index) => (
              <li
                key={stay.key}
                className="space-y-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <SmartImage
                    src={stay.city.image}
                    alt=""
                    decorative
                    seed={`${stay.city.name} ${stay.city.country}`}
                    className="size-10 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{stay.city.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {stay.city.country} · {stayLabel(stay)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(stay.key)}
                    aria-label={`Remove ${stay.city.name}`}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`stay-${stay.key}-from`} className="text-xs">
                      Arrive
                    </Label>
                    <Input
                      id={`stay-${stay.key}-from`}
                      type="date"
                      value={stay.startDate}
                      min={startDate}
                      max={endDate}
                      className="h-9"
                      onChange={(event) => onUpdate(stay.key, { startDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`stay-${stay.key}-to`} className="text-xs">
                      Leave
                    </Label>
                    <Input
                      id={`stay-${stay.key}-to`}
                      type="date"
                      value={stay.endDate}
                      min={stay.startDate}
                      max={endDate}
                      className="h-9"
                      onChange={(event) => onUpdate(stay.key, { endDate: event.target.value })}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {stays.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Stays stay inside your trip dates ({formatDateRange(startDate, endDate)}) and are
            re-arranged automatically if you move a date.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Step 3: itinerary ────────────────────────────────────────────────────────

function StepItinerary({
  stays,
  activities,
  activeStay,
  activeDay,
  onSelectStay,
  onSelectDay,
  onAdd,
  onRemove,
  onContinue,
}: {
  stays: DraftStay[];
  activities: DraftActivity[];
  activeStay: DraftStay | null;
  activeDay: string | null;
  onSelectStay: (key: string) => void;
  onSelectDay: (day: string) => void;
  onAdd: (cityId: string, activity: Activity, date: string) => void;
  onRemove: (key: string) => void;
  onContinue: () => void;
}) {
  if (!activeStay) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Add a destination first"
        description="Head back to the destinations step, add a city, and you can start filling your days here."
        action={<Button onClick={onContinue}>Back to destinations</Button>}
      />
    );
  }

  const days = daysBetween(activeStay.startDate, activeStay.endDate);
  const day = activeDay && days.includes(activeDay) ? activeDay : (days[0] ?? null);
  const dayItems = activities
    .filter((item) => item.date === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Build your itinerary</h2>
        <p className="text-sm text-muted-foreground">
          Optional — add experiences now, or leave it and build the days later in the trip
          workspace.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {stays.map((stay) => (
          <button
            key={stay.key}
            type="button"
            onClick={() => onSelectStay(stay.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              stay.key === activeStay.key
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
            aria-pressed={stay.key === activeStay.key}
          >
            <MapPin className="size-3.5" aria-hidden="true" />
            {stay.city.name}
            <span className="text-xs opacity-70">
              {activities.filter((item) => item.cityId === stay.city.id).length}
            </span>
          </button>
        ))}
      </div>

      <div className="rail no-scrollbar gap-2">
        {days.map((date, index) => {
          const count = activities.filter((item) => item.date === date).length;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(date)}
              aria-pressed={date === day}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                date === day
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <span className="block font-semibold">Day {index + 1}</span>
              <span className="block text-muted-foreground">
                {new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <span className="block text-primary">{count > 0 ? `${count} planned` : '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            {activeStay.city.name} · {day ? formatDateRange(day, day) : 'Pick a day'}
          </h3>
          {dayItems.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing planned for this day yet. Add something from the list on the right.
            </p>
          ) : (
            <ul className="space-y-2">
              {dayItems.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                    {formatTime(item.startTime)}
                  </span>
                  <SmartImage
                    src={item.activity.image}
                    alt=""
                    decorative
                    seed={item.activity.name}
                    className="size-10 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.activity.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(item.activity.duration)} ·{' '}
                      {formatCurrency(item.activity.estimatedCost, 'INR')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(item.key)}
                    aria-label={`Remove ${item.activity.name}`}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="h-[26rem]">
          <ActivityPicker
            cityId={activeStay.city.id}
            cityName={activeStay.city.name}
            onAdd={(activity) => day && onAdd(activeStay.city.id, activity, day)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 4: budget ───────────────────────────────────────────────────────────

function StepBudget({
  budgetLimit,
  onBudgetChange,
  activityTotal,
  stayTotal,
  referenceTotal,
  overBudget,
  currency,
  stays,
}: {
  budgetLimit: string;
  onBudgetChange: (value: string) => void;
  activityTotal: number;
  stayTotal: number;
  referenceTotal: number;
  overBudget: boolean;
  currency: string;
  stays: Array<{ city: City; startDate: string; endDate: string }>;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Set a budget</h2>
        <p className="text-sm text-muted-foreground">
          Optional — a limit lets GlobeTrotter warn you as you add activities and expenses.
        </p>
      </header>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="budgetLimit">Trip budget ({currency})</Label>
        <Input
          id="budgetLimit"
          type="number"
          min={0}
          step={500}
          inputMode="numeric"
          value={budgetLimit}
          onChange={(event) => onBudgetChange(event.target.value)}
          placeholder="e.g. 45000"
        />
        <FieldHint>Leave blank if you would rather not track a limit.</FieldHint>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
        <h3 className="text-sm font-semibold">Current reference estimate</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Activities selected</dt>
            <dd className="font-medium">{formatCurrency(activityTotal, currency)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              Stays ({stays.length} {stays.length === 1 ? 'city' : 'cities'})
            </dt>
            <dd className="font-medium">{formatCurrency(stayTotal, currency)}</dd>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium">Reference total</dt>
            <dd className="text-base font-semibold text-primary">
              {formatCurrency(referenceTotal, currency)}
            </dd>
          </div>
        </dl>

        {budgetLimit !== '' && Number.isFinite(Number(budgetLimit)) ? (
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              overBudget ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
            )}
          >
            {overBudget
              ? `⚠️ Your reference estimate is ${formatCurrency(referenceTotal - Number(budgetLimit), currency)} above your budget.`
              : `You have ${formatCurrency(Number(budgetLimit) - referenceTotal, currency)} of headroom.`}
          </p>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Stays are estimated from each destination&apos;s average daily cost for the number of days
          you are there. Add real expenses on the budget page once the trip is created.
        </p>
      </div>
    </div>
  );
}

// ── Step 5: review ───────────────────────────────────────────────────────────

function StepReview({
  name,
  coverImage,
  description,
  startDate,
  endDate,
  isPublic,
  stays,
  activities,
  budgetLimit,
  referenceTotal,
  currency,
  onEditStep,
}: {
  name: string;
  coverImage: string;
  description: string;
  startDate: string;
  endDate: string;
  isPublic: boolean;
  stays: Array<{ city: City; startDate: string; endDate: string }>;
  activities: DraftActivity[];
  budgetLimit: number | null;
  referenceTotal: number;
  currency: string;
  onEditStep: (index: number) => void;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Review your trip</h2>
        <p className="text-sm text-muted-foreground">
          Everything below is editable later — this is just to make sure the shape is right.
        </p>
      </header>

      <div className="flex gap-4">
        <SmartImage
          src={coverImage || null}
          alt=""
          decorative
          seed={name || 'GlobeTrotter'}
          className="h-28 w-44 shrink-0 rounded-xl"
        />
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-base font-semibold">{name || 'Untitled trip'}</h3>
          <p className="text-sm text-muted-foreground">{formatDateRange(startDate, endDate)}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{pluralise(dayCount(startDate, endDate), 'day')}</Badge>
            <Badge variant="secondary">{pluralise(stays.length, 'city', 'cities')}</Badge>
            <Badge variant="secondary">{pluralise(activities.length, 'activity', 'activities')}</Badge>
            {isPublic ? (
              <Badge variant="outline">
                <Globe2 aria-hidden="true" />
                Public
              </Badge>
            ) : (
              <Badge variant="outline">
                <Lock aria-hidden="true" />
                Private
              </Badge>
            )}
          </div>
          {description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      <Separator />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Route</h3>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(1)}>
            Edit destinations
          </Button>
        </div>
        {stays.length === 0 ? (
          <p className="text-sm text-destructive">
            No destinations yet — go back and add at least one.
          </p>
        ) : (
          <ol className="space-y-2">
            {stays.map((stay, index) => (
              <li key={stay.city.id} className="flex items-center gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="font-medium">{stay.city.name}</span>
                <span className="text-muted-foreground">{stayLabel(stay)}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {pluralise(dayCount(stay.startDate, stay.endDate), 'day')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Separator />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Itinerary</h3>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(2)}>
            Edit itinerary
          </Button>
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activities yet. You can add them any time from the itinerary builder.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {activities.map((item) => (
              <li key={item.key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {formatDateRange(item.date, item.date)}
                </span>
                <span className="w-16 shrink-0 text-xs text-muted-foreground">
                  {formatTime(item.startTime)}
                </span>
                <span className="truncate">{item.activity.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {formatCurrency(item.activity.estimatedCost, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Budget</h3>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(3)}>
            Edit budget
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Reference estimate</span>
          <span className="font-semibold">{formatCurrency(referenceTotal, currency)}</span>
          {budgetLimit !== null ? (
            <Badge variant={referenceTotal > budgetLimit ? 'destructive' : 'success'}>
              Limit {formatCurrency(budgetLimit, currency)}
            </Badge>
          ) : (
            <Badge variant="outline">No limit set</Badge>
          )}
        </div>
      </section>

      {stays.length > 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Ready to go. Creating the trip takes a moment — we add the cities first, then the
          activities.
        </p>
      ) : null}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-40 truncate text-right font-medium">{value}</span>
    </div>
  );
}

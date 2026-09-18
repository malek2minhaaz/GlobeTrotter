import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, TriangleAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/input';
import { Separator, SwitchRow } from '@/components/ui/misc';
import { PageHeader } from '@/components/common/PageHeader';
import { ImagePicker } from '@/components/common/ImagePicker';
import { queryKeys } from '@/lib/queryClient';
import { tripsService } from '@/services/trips.service';
import { toast } from '@/lib/toast';
import { applyApiFieldErrors } from '@/lib/formErrors';
import { tripDetailsSchema, type TripDetailsForm } from '@/lib/schemas';
import { dayCount, formatCurrency, formatDateRange, pluralise } from '@/lib/format';
import { useTripWorkspace } from '@/layouts/TripWorkspaceLayout';
import { useCurrency } from '@/hooks/useCurrency';
import type { TripStop } from '@/types/api';

/**
 * Edit trip details.
 *
 * Dates are the outer boundary for every stay, so this page warns before saving
 * when a shortened window would leave a city outside the trip.
 */
export default function EditTripPage() {
  const { trip } = useTripWorkspace();
  const currency = useCurrency();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = React.useState(false);
  const [budgetLimit, setBudgetLimit] = React.useState(
    trip.budgetLimit === null ? '' : String(trip.budgetLimit),
  );
  const [budgetError, setBudgetError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TripDetailsForm>({
    resolver: zodResolver(tripDetailsSchema),
    defaultValues: {
      name: trip.name,
      description: trip.description ?? '',
      coverImage: trip.coverImage ?? '',
      startDate: trip.startDate,
      endDate: trip.endDate,
      isPublic: trip.isPublic,
    },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const coverImage = watch('coverImage') ?? '';
  const isPublic = watch('isPublic');
  const name = watch('name');

  const strandedStops = trip.stops.filter(
    (stop: TripStop) => stop.startDate < startDate || stop.endDate > endDate,
  );

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripBudget(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: ['trips'] });
  }, [queryClient, trip.id]);

  const save = useMutation({
    mutationFn: (values: TripDetailsForm & { budgetLimit: number | null }) =>
      tripsService.update(trip.id, {
        name: values.name,
        description: values.description || null,
        coverImage: values.coverImage || null,
        startDate: values.startDate,
        endDate: values.endDate,
        isPublic: values.isPublic,
        budgetLimit: values.budgetLimit,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Trip updated');
      navigate(`/trips/${trip.id}`);
    },
    onError: (error) => toast.fromError(error, 'We could not save your changes.'),
  });

  const onSubmit = handleSubmit(async (values) => {
    setBudgetError(null);
    let limit: number | null = null;

    if (budgetLimit.trim() !== '') {
      const parsed = Number(budgetLimit);
      if (Number.isNaN(parsed) || parsed < 0) {
        setBudgetError('Enter a valid amount, or leave it blank to remove the limit.');
        return;
      }
      limit = parsed;
    }

    setSaving(true);
    try {
      await save.mutateAsync({ ...values, budgetLimit: limit });
    } catch (error) {
      applyApiFieldErrors(setError, error, ['name', 'startDate', 'endDate', 'coverImage']);
    } finally {
      setSaving(false);
    }
  });

  return (
    <>
      <PageHeader
        eyebrow="Edit trip"
        title={trip.name}
        description="Change the name, dates, cover image, budget or sharing setting."
        actions={
          <Button asChild variant="ghost">
            <Link to={`/trips/${trip.id}`}>
              <ArrowLeft />
              Back to trip
            </Link>
          </Button>
        }
      />

      <form onSubmit={onSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]" noValidate>
        <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="space-y-1.5">
            <Label htmlFor="name">Trip name</Label>
            <Input id="name" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              <FieldError>{errors.startDate?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              <FieldError>{errors.endDate?.message}</FieldError>
            </div>
          </div>

          {strandedStops.length > 0 ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-[color-mix(in_oklch,var(--warning),black_30%)] dark:text-warning"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {pluralise(strandedStops.length, 'city', 'cities')} (
                {strandedStops.map((stop) => stop.city.name).join(', ')}) would fall outside these
                dates, so the change would be refused. Move those stay dates inside the new window
                from the itinerary builder first.
              </span>
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} />
            <FieldError>{errors.description?.message}</FieldError>
          </div>

          <ImagePicker
            id="coverImage"
            label="Cover image"
            value={coverImage}
            onChange={(value) => setValue('coverImage', value, { shouldDirty: true })}
            seed={name || trip.name}
            error={errors.coverImage?.message}
          />

          <Separator />

          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="budgetLimit">Trip budget ({currency})</Label>
            <Input
              id="budgetLimit"
              type="number"
              min={0}
              step={500}
              value={budgetLimit}
              onChange={(event) => setBudgetLimit(event.target.value)}
              placeholder="Leave blank for no limit"
            />
            {budgetError ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {budgetError}
              </p>
            ) : (
              <FieldHint>
                Current estimate: {formatCurrency(trip.estimatedCost, currency)}
              </FieldHint>
            )}
          </div>

          <Separator />

          <SwitchRow
            id="isPublic"
            label="Public trip"
            description="Public trips get a share link anyone can open and copy."
            checked={isPublic}
            onCheckedChange={(checked) => setValue('isPublic', checked, { shouldDirty: true })}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" loading={saving}>
              <Save />
              Save changes
            </Button>
            <Button asChild variant="outline">
              <Link to={`/trips/${trip.id}`}>Cancel</Link>
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">What changes</h2>
            <dl className="space-y-2 text-sm">
              <Row label="New dates" value={formatDateRange(startDate, endDate)} />
              <Row label="Length" value={pluralise(dayCount(startDate, endDate), 'day')} />
              <Row label="Cities" value={String(trip.stops.length)} />
              <Row
                label="Activities"
                value={String(trip.itineraryItems.length)}
              />
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="size-3.5" aria-hidden="true" />
                  Estimated cost
                </dt>
                <dd className="font-semibold text-primary">
                  {formatCurrency(trip.estimatedCost, currency)}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] text-muted-foreground">
              Shortening the trip does not delete anything automatically — use the itinerary builder
              to remove or reschedule activities that fall outside.
            </p>
          </div>
        </aside>
      </form>
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

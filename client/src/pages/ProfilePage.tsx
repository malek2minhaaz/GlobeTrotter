import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bookmark,
  CalendarDays,
  Globe2,
  Mail,
  MapPin,
  Pencil,
  Plane,
  Save,
  Settings,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator, UserAvatar } from '@/components/ui/misc';
import { ErrorState, LoadingPanel } from '@/components/ui/feedback';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { ImagePicker } from '@/components/common/ImagePicker';
import { StatCard } from '@/components/common/StatCard';
import { queryKeys } from '@/lib/queryClient';
import { profileService } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { applyApiFieldErrors } from '@/lib/formErrors';
import { profileSchema, type ProfileForm } from '@/lib/schemas';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  currencyLabel,
  languageLabel,
} from '@/lib/languages';
import { formatDate } from '@/lib/format';

/**
 * Profile (Section 22).
 *
 * Details are editable in place, and the same page surfaces the traveller's own
 * numbers — trips, cities planned and public trips — plus their bookmarks.
 */
export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: profileService.get,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      avatar: user?.avatar ?? '',
      language: user?.language ?? 'en',
      currency: user?.currency ?? 'INR',
    },
  });

  const avatar = watch('avatar') ?? '';
  const name = watch('name');

  const saveProfile = useMutation({
    mutationFn: (values: ProfileForm) =>
      profileService.update({
        name: values.name,
        email: values.email,
        avatar: values.avatar || null,
        language: values.language,
        currency: values.currency,
      }),
    onSuccess: async (result) => {
      // Keep the session cache in step so the header updates immediately.
      queryClient.setQueryData(queryKeys.auth, { user: result.profile });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void refresh();
      setEditing(false);
      toast.success('Profile updated');
    },
    onError: (error) => {
      const handled = applyApiFieldErrors(setError, error, [
        'name',
        'email',
        'avatar',
        'language',
        'currency',
      ]);
      if (!handled) toast.fromError(error, 'We could not save your profile.');
    },
  });

  const cancelEdit = () => {
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      avatar: user?.avatar ?? '',
      language: user?.language ?? 'en',
      currency: user?.currency ?? 'INR',
    });
    setEditing(false);
  };

  if (profileQuery.isLoading) {
    return <LoadingPanel label="Loading your profile…" className="min-h-[50dvh]" />;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorState
        title="We could not load your profile"
        message="Please try again in a moment."
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const { profile, stats } = profileQuery.data;

  return (
    <>
      <RouteMeta title="Profile" />

      <div className="space-y-6">
        <PageHeader
          title="Your profile"
          description="Your details, your travel numbers and everywhere you have bookmarked."
          actions={
            <>
              <Button asChild variant="outline">
                <Link to="/settings">
                  <Settings />
                  Settings
                </Link>
              </Button>
              {!editing ? (
                <Button onClick={() => setEditing(true)}>
                  <Pencil />
                  Edit profile
                </Button>
              ) : null}
            </>
          }
        />

        {/* ── Identity ── */}
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-accent" />
          <div className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
            <UserAvatar
              name={profile.name}
              src={profile.avatar}
              className="-mt-10 size-20 border-4 border-card text-lg"
            />
            <div className="min-w-0 flex-1 space-y-1 sm:pb-1">
              <h2 className="truncate text-xl font-semibold">{profile.name}</h2>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" aria-hidden="true" />
                  {profile.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="size-3.5" aria-hidden="true" />
                  {languageLabel(profile.language)}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:pb-1">
              <Badge variant="secondary">Member since {formatDate(profile.createdAt, 'MMM yyyy')}</Badge>
              {profile.role === 'ADMIN' ? <Badge variant="solid">Admin</Badge> : null}
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Plane} label="Total trips" value={String(stats.totalTrips)} to="/trips" />
          <StatCard
            icon={Globe2}
            label="Public trips"
            value={String(stats.publicTrips)}
            hint="Visible to anyone with the link"
            to="/trips?visibility=PUBLIC"
            accent="violet"
          />
          <StatCard
            icon={MapPin}
            label="Cities planned"
            value={String(stats.citiesPlanned)}
            to="/trips"
            accent="amber"
          />
          <StatCard
            icon={Bookmark}
            label="Saved destinations"
            value={String(stats.savedDestinations)}
            to="/saved"
            accent="rose"
          />
        </section>

        {/* ── Details ── */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Account details</h2>
              {editing ? (
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X />
                  Cancel
                </Button>
              ) : null}
            </div>

            {!editing ? (
              <dl className="space-y-3 text-sm">
                <Row label="Full name" value={profile.name} />
                <Row label="Email" value={profile.email} />
                <Row label="Language" value={languageLabel(profile.language)} />
                <Row label="Currency" value={currencyLabel(profile.currency)} />
                <Row
                  label="Default theme"
                  value={
                    profile.preferences.theme === 'system'
                      ? 'Follow device'
                      : profile.preferences.theme === 'dark'
                        ? 'Dark'
                        : 'Light'
                  }
                />
                <Separator />
                <Row
                  label="Trips public by default"
                  value={profile.preferences.tripsPublicByDefault ? 'Yes' : 'No'}
                />
                <p className="pt-1 text-xs text-muted-foreground">
                  Change any of these from <Link to="/settings" className="text-primary underline-offset-4 hover:underline">Settings</Link>.
                </p>
              </dl>
            ) : (
              <form
                onSubmit={handleSubmit((values) => saveProfile.mutate(values))}
                className="space-y-5"
                noValidate
              >
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input id="profile-name" {...register('name')} />
                  <FieldError>{errors.name?.message}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input id="profile-email" type="email" {...register('email')} />
                  <FieldError>{errors.email?.message}</FieldError>
                  <FieldHint>Changing this changes how you sign in.</FieldHint>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-language">Language</Label>
                    <Select
                      value={watch('language')}
                      onValueChange={(value) => setValue('language', value, { shouldDirty: true })}
                    >
                      <SelectTrigger id="profile-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-currency">Currency</Label>
                    <Select
                      value={watch('currency')}
                      onValueChange={(value) => setValue('currency', value, { shouldDirty: true })}
                    >
                      <SelectTrigger id="profile-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <ImagePicker
                  id="profile-avatar"
                  label="Profile image"
                  value={avatar}
                  onChange={(value) => setValue('avatar', value, { shouldDirty: true })}
                  seed={name || profile.name}
                  error={errors.avatar?.message}
                  rounded="rounded-full"
                  aspect="aspect-square max-w-32"
                  hint="Paste an image URL or upload a file under 2 MB."
                />

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={saveProfile.isPending}>
                    <Save />
                    Save changes
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </section>

          {/* ── Saved destinations ── */}
          <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Saved destinations</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/saved">View all</Link>
              </Button>
            </div>

            {stats.savedDestinations === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have not bookmarked anywhere yet. Browse{' '}
                <Link to="/discover" className="text-primary underline-offset-4 hover:underline">
                  destinations
                </Link>{' '}
                and tap the bookmark to keep them here.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {stats.savedDestinations} destinations bookmarked.{' '}
                <Link to="/saved" className="text-primary underline-offset-4 hover:underline">
                  Open the list
                </Link>
                .
              </p>
            )}

            <Separator />

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Recently planned</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {stats.totalTrips} trips created
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {stats.citiesPlanned} cities planned
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Globe2 className="size-3.5" aria-hidden="true" />
                  {stats.publicTrips} shared publicly
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

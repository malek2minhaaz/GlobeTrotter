import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bell,
  Globe2,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  ShieldAlert,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input';
import { Separator, SwitchRow } from '@/components/ui/misc';
import { ErrorState, LoadingPanel } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { RouteMeta } from '@/components/common/RouteMeta';
import { PasswordField, PasswordStrength } from '@/components/auth/PasswordField';
import { queryKeys } from '@/lib/queryClient';
import { authService, profileService, type UpdatePreferencesPayload } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/toast';
import { applyApiFieldErrors } from '@/lib/formErrors';
import {
  changePasswordSchema,
  deleteAccountSchema,
  type ChangePasswordForm,
  type DeleteAccountForm,
} from '@/lib/schemas';
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from '@/lib/languages';
import { cn } from '@/lib/utils';
import type { ThemePreference, UserPreferences } from '@/types/api';

/**
 * Settings (Section 23).
 *
 * Account, preferences, privacy and deletion. Destructive actions are confirmed
 * in a dialog and require the current password, and a theme change is written
 * both locally and to the profile so it survives a new device.
 */
export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: profileService.get,
  });

  const preferences: UserPreferences | undefined = profileQuery.data?.profile.preferences;

  const savePreferences = useMutation({
    mutationFn: (payload: UpdatePreferencesPayload) => profileService.updatePreferences(payload),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.auth, { user: result.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      toast.success('Preferences saved');
    },
    onError: (error) => toast.fromError(error, 'We could not save your preferences.'),
  });

  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });

  const changePassword = useMutation({
    mutationFn: (values: ChangePasswordForm) =>
      authService.changePassword({
        currentPassword: values.currentPassword,
        password: values.password,
        confirmPassword: values.confirmPassword,
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Password changed', 'Use your new password next time you sign in.');
    },
    onError: (error) => {
      const handled = applyApiFieldErrors(passwordForm.setError, error, [
        'currentPassword',
        'password',
        'confirmPassword',
      ]);
      if (!handled) toast.fromError(error, 'We could not change your password.');
    },
  });

  const deleteForm = useForm<DeleteAccountForm>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  const deleteAccount = useMutation({
    mutationFn: (values: DeleteAccountForm) =>
      profileService.deleteAccount({ password: values.password, confirmation: values.confirmation }),
    onSuccess: async () => {
      setDeleteOpen(false);
      toast.success('Account deleted', 'Your trips and data have been removed.');
      await logout();
      navigate('/', { replace: true });
    },
    onError: (error) => {
      const handled = applyApiFieldErrors(deleteForm.setError, error, ['password', 'confirmation']);
      if (!handled) toast.fromError(error, 'We could not delete your account.');
    },
  });

  const changeTheme = (next: ThemePreference) => {
    setTheme(next);
    savePreferences.mutate({ theme: next });
  };

  if (profileQuery.isLoading) {
    return <LoadingPanel label="Loading your settings…" className="min-h-[50dvh]" />;
  }

  if (profileQuery.isError || !profileQuery.data || !preferences) {
    return (
      <ErrorState
        title="We could not load your settings"
        message="Please try again in a moment."
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const profile = profileQuery.data.profile;

  return (
    <>
      <RouteMeta title="Settings" />

      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your account, how GlobeTrotter looks, and what we notify you about."
          actions={
            <Button asChild variant="outline">
              <Link to="/profile">
                <UserRound />
                View profile
              </Link>
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Account ── */}
          <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <header className="space-y-1">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <UserRound className="size-4 text-primary" aria-hidden="true" />
                Account settings
              </h2>
              <p className="text-sm text-muted-foreground">
                Your name and email are on your{' '}
                <Link to="/profile" className="text-primary underline-offset-4 hover:underline">
                  profile
                </Link>
                .
              </p>
            </header>

            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{profile.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-medium">{profile.email}</dd>
              </div>
            </dl>

            <Separator />

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-4 text-primary" aria-hidden="true" />
                Change password
              </h3>

              <form
                onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))}
                className="space-y-4"
                noValidate
              >
                <PasswordField
                  id="currentPassword"
                  label="Current password"
                  autoComplete="current-password"
                  error={passwordForm.formState.errors.currentPassword?.message}
                  {...passwordForm.register('currentPassword')}
                />

                <div className="space-y-3">
                  <PasswordField
                    id="newPassword"
                    label="New password"
                    autoComplete="new-password"
                    error={passwordForm.formState.errors.password?.message}
                    {...passwordForm.register('password')}
                  />
                  <PasswordStrength password={passwordForm.watch('password') ?? ''} />
                </div>

                <PasswordField
                  id="confirmNewPassword"
                  label="Confirm new password"
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register('confirmPassword')}
                />

                <Button type="submit" loading={changePassword.isPending}>
                  Update password
                </Button>
              </form>
            </div>
          </section>

          {/* ── Preferences ── */}
          <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <header className="space-y-1">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Palette className="size-4 text-primary" aria-hidden="true" />
                Preference settings
              </h2>
              <p className="text-sm text-muted-foreground">
                Appearance and the defaults used when you create trips.
              </p>
            </header>

            <div className="space-y-2">
              <p className="text-sm font-medium">Appearance</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'system', label: 'Device', icon: Monitor },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeTheme(option.value)}
                    aria-pressed={theme === option.value}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors',
                      theme === option.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    <option.icon className="size-4" aria-hidden="true" />
                    {option.label}
                  </button>
                ))}
              </div>
              <FieldHint>
                Your choice is saved to your profile, so it follows you to another device.
              </FieldHint>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-language" className="flex items-center gap-1.5">
                  <Globe2 className="size-3.5" aria-hidden="true" />
                  Language
                </Label>
                <Select
                  value={profile.language}
                  onValueChange={(value) =>
                    profileService
                      .update({ language: value })
                      .then((result) => {
                        queryClient.setQueryData(queryKeys.auth, { user: result.profile });
                        void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
                        toast.success('Language updated');
                      })
                      .catch((error) => toast.fromError(error))
                  }
                >
                  <SelectTrigger id="settings-language">
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
                <Label htmlFor="settings-currency">Currency</Label>
                <Select
                  value={profile.currency}
                  onValueChange={(value) =>
                    profileService
                      .update({ currency: value })
                      .then((result) => {
                        queryClient.setQueryData(queryKeys.auth, { user: result.profile });
                        void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
                        toast.success('Currency updated');
                      })
                      .catch((error) => toast.fromError(error))
                  }
                >
                  <SelectTrigger id="settings-currency">
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

            <Separator />

            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="size-4 text-primary" aria-hidden="true" />
                Notifications
              </h3>
              <div className="divide-y divide-border">
                <SwitchRow
                  id="notifyUpcomingTrips"
                  label="Upcoming trip reminders"
                  description="Tell me when a trip is about to start."
                  checked={preferences.notifyUpcomingTrips}
                  disabled={savePreferences.isPending}
                  onCheckedChange={(checked) =>
                    savePreferences.mutate({ notifyUpcomingTrips: checked })
                  }
                />
                <SwitchRow
                  id="notifyBudgetAlerts"
                  label="Budget alerts"
                  description="Warn me when an estimate passes my limit."
                  checked={preferences.notifyBudgetAlerts}
                  disabled={savePreferences.isPending}
                  onCheckedChange={(checked) =>
                    savePreferences.mutate({ notifyBudgetAlerts: checked })
                  }
                />
                <SwitchRow
                  id="notifyItineraryConflicts"
                  label="Itinerary conflict warnings"
                  description="Flag overlapping or out-of-range activities."
                  checked={preferences.notifyItineraryConflicts}
                  disabled={savePreferences.isPending}
                  onCheckedChange={(checked) =>
                    savePreferences.mutate({ notifyItineraryConflicts: checked })
                  }
                />
              </div>
            </div>
          </section>

          {/* ── Privacy ── */}
          <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <header className="space-y-1">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <ShieldAlert className="size-4 text-primary" aria-hidden="true" />
                Privacy settings
              </h2>
              <p className="text-sm text-muted-foreground">
                Sharing is off by default. Nothing is visible to anyone else until you publish it.
              </p>
            </header>

            <SwitchRow
              id="tripsPublicByDefault"
              label="New trips are public by default"
              description="Only applies to trips created from now on — existing trips keep their setting."
              checked={preferences.tripsPublicByDefault}
              disabled={savePreferences.isPending}
              onCheckedChange={(checked) =>
                savePreferences.mutate({ tripsPublicByDefault: checked })
              }
            />

            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Public pages show your name, your itinerary and activity estimates. They never show
              your email address or your logged expenses.
            </p>
          </section>

          {/* ── Danger zone ── */}
          <section className="space-y-4 rounded-xl border border-destructive/35 bg-destructive/5 p-5 shadow-sm sm:p-6">
            <header className="space-y-1">
              <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
                <Trash2 className="size-4" aria-hidden="true" />
                Delete account
              </h2>
              <p className="text-sm text-muted-foreground">
                Permanently removes your account, every trip you own, their itineraries, expenses and
                saved destinations. This cannot be undone.
              </p>
            </header>

            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              Delete my account
            </Button>
          </section>
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) deleteForm.reset();
        }}
        destructive
        loading={deleteAccount.isPending}
        title="Delete your GlobeTrotter account?"
        description={
          <form
            onSubmit={deleteForm.handleSubmit((values) => deleteAccount.mutate(values))}
            className="space-y-4 pt-2"
            noValidate
          >
            <p className="text-sm text-muted-foreground">
              {user?.email} and everything in it will be deleted. Enter your password and type{' '}
              <span className="font-semibold text-foreground">DELETE</span> to confirm.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                {...deleteForm.register('password')}
              />
              <FieldError>{deleteForm.formState.errors.password?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirmation">Type DELETE</Label>
              <Input
                id="delete-confirmation"
                placeholder="DELETE"
                autoComplete="off"
                {...deleteForm.register('confirmation')}
              />
              <FieldError>{deleteForm.formState.errors.confirmation?.message}</FieldError>
            </div>
            <button type="submit" className="sr-only">
              Confirm account deletion
            </button>
          </form>
        }
        confirmLabel="Delete my account"
        onConfirm={() => deleteForm.handleSubmit((values) => deleteAccount.mutate(values))()}
      />
    </>
  );
}

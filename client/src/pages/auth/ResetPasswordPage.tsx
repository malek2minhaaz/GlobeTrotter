import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { PasswordField, PasswordStrength } from '@/components/auth/PasswordField';
import { RouteMeta } from '@/components/common/RouteMeta';
import { authService } from '@/services/auth.service';
import { applyApiFieldErrors } from '@/lib/formErrors';
import { resetPasswordSchema, type ResetPasswordForm } from '@/lib/schemas';
import { toast } from '@/lib/toast';

/** Reset password — reached from the emailed (or development) link. */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await authService.resetPassword(values);
      toast.success('Password updated', 'Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      const handled = applyApiFieldErrors(setError, error, ['token', 'password', 'confirmPassword']);
      if (!handled) toast.fromError(error, 'We could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  });

  if (!token) {
    return (
      <>
        <RouteMeta title="Reset link invalid" />
        <EmptyState
          icon={ShieldAlert}
          title="This reset link is not valid"
          description="The link may have expired or been copied incompletely. Request a new one and we will send fresh instructions."
          action={
            <Button asChild>
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <RouteMeta title="Choose a new password" />
      <div className="space-y-6">
        <header className="space-y-1.5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
          </span>
          <h1 className="pt-2 text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            Pick something you have not used before. You will be signed out everywhere else.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" {...register('token')} />

          <div className="space-y-3">
            <PasswordField
              id="password"
              label="New password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordStrength password={password ?? ''} />
          </div>

          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            Update password
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </>
  );
}

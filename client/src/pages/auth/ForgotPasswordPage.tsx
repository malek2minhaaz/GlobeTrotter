import * as React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { RouteMeta } from '@/components/common/RouteMeta';
import { authService, type ForgotPasswordResult } from '@/services/auth.service';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/schemas';
import { toast } from '@/lib/toast';

/**
 * Forgot password (Section 8).
 *
 * Email delivery is not configured locally, so in development the API returns the
 * reset token and this page links straight to the reset screen. In production the
 * token is never sent to the browser and only the confirmation is shown.
 */
export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ForgotPasswordResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      setResult(await authService.forgotPassword(values.email));
    } catch (error) {
      toast.fromError(error, 'We could not start the reset. Please try again.');
    } finally {
      setSubmitting(false);
    }
  });

  if (result) {
    return (
      <>
        <RouteMeta title="Check your email" />
        <div className="space-y-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-5 text-primary" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">{result.message}</p>
          </div>

          {result.developmentResetToken ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Development mode
              </p>
              <p className="text-sm text-muted-foreground">
                Email delivery is not configured, so you can continue with the generated reset link
                below. It expires in one hour.
              </p>
              <Button asChild className="w-full">
                <Link to={`/reset-password?token=${result.developmentResetToken}`}>
                  Continue to reset password
                </Link>
              </Button>
            </div>
          ) : null}

          <Button asChild variant="ghost" size="sm">
            <Link to="/login">
              <ArrowLeft />
              Back to sign in
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <RouteMeta title="Reset your password" />
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
          <p className="text-sm text-muted-foreground">
            Enter the email on your account and we will send reset instructions.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            <FieldError id="email-error">{errors.email?.message}</FieldError>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            Send reset instructions
            {submitting ? null : <Send />}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </p>
      </div>
    </>
  );
}

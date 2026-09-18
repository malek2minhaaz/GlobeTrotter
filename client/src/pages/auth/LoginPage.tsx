import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/tooltip-checkbox';
import { PasswordField } from '@/components/auth/PasswordField';
import { RouteMeta } from '@/components/common/RouteMeta';
import { useAuth } from '@/contexts/AuthContext';
import { applyApiFieldErrors } from '@/lib/formErrors';
import { loginSchema, type LoginForm } from '@/lib/schemas';
import { toast } from '@/lib/toast';

const DEMO_EMAIL = 'demo@globetrotter.app';
const DEMO_PASSWORD = 'Password123!';

/** Login (Section 8). */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const destination = redirect && redirect.startsWith('/') ? redirect : '/dashboard';

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`, 'Your trips are ready when you are.');
      navigate(destination, { replace: true });
    } catch (error) {
      const handled = applyApiFieldErrors(setError, error, ['email', 'password']);
      if (!handled) toast.fromError(error, 'We could not sign you in.');
    } finally {
      setSubmitting(false);
    }
  });

  const fillDemoCredentials = () => {
    setValue('email', DEMO_EMAIL, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
  };

  return (
    <>
      <RouteMeta title="Sign in" description="Sign in to GlobeTrotter to plan and manage your trips." />

      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to pick up your itineraries, budgets and saved destinations.
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

          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                {...register('rememberMe')}
                onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
              />
              <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground">
                Remember me for 30 days
              </Label>
            </div>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            Sign in
            {submitting ? null : <ArrowRight />}
          </Button>
        </form>

        {import.meta.env.DEV ? (
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Use the seeded demo account ({DEMO_EMAIL})
          </button>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          New to GlobeTrotter?{' '}
          <Link
            to={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </>
  );
}

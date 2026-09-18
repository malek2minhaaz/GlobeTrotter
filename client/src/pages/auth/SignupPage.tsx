import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input';
import { PasswordField, PasswordStrength } from '@/components/auth/PasswordField';
import { RouteMeta } from '@/components/common/RouteMeta';
import { SmartImage } from '@/components/common/SmartImage';
import { useAuth } from '@/contexts/AuthContext';
import { applyApiFieldErrors } from '@/lib/formErrors';
import { signupSchema, type SignupForm } from '@/lib/schemas';
import { toast } from '@/lib/toast';

/** Signup (Section 8). Registering signs the traveller straight in. */
export default function SignupPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', avatar: '' },
  });

  const password = watch('password');
  const avatar = watch('avatar');
  const destination = redirect && redirect.startsWith('/') ? redirect : '/dashboard';

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const user = await createAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
        avatar: values.avatar || null,
      });
      toast.success(`Welcome to GlobeTrotter, ${user.name.split(' ')[0]}`, 'Let us plan your first trip.');
      navigate(destination, { replace: true });
    } catch (error) {
      const handled = applyApiFieldErrors(setError, error, [
        'name',
        'email',
        'password',
        'confirmPassword',
        'avatar',
      ]);
      if (!handled) toast.fromError(error, 'We could not create your account.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <RouteMeta
        title="Create your account"
        description="Create a free GlobeTrotter account to plan multi-city trips, track budgets and share itineraries."
      />

      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Start planning for free</h1>
          <p className="text-sm text-muted-foreground">
            Build multi-city itineraries, track spending and share your journey with anyone.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Ananya Sharma"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
              {...register('name')}
            />
            <FieldError id="name-error">{errors.name?.message}</FieldError>
          </div>

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

          <div className="space-y-3">
            <PasswordField
              id="password"
              label="Password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordStrength password={password ?? ''} />
          </div>

          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="space-y-1.5">
            <Label htmlFor="avatar" className="flex items-center gap-1.5">
              <ImagePlus className="size-3.5" aria-hidden="true" />
              Profile image URL
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="flex items-center gap-3">
              <SmartImage
                src={avatar || null}
                alt="Profile preview"
                seed={watch('name') || 'GlobeTrotter'}
                className="size-11 shrink-0 rounded-full"
              />
              <Input
                id="avatar"
                placeholder="https://…"
                aria-invalid={errors.avatar ? true : undefined}
                aria-describedby={errors.avatar ? 'avatar-error' : 'avatar-hint'}
                {...register('avatar')}
              />
            </div>
            <FieldError id="avatar-error">{errors.avatar?.message}</FieldError>
            {!errors.avatar ? (
              <FieldHint id="avatar-hint">
                Leave this blank and we will use your initials instead.
              </FieldHint>
            ) : null}
          </div>

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            Create my account
            {submitting ? null : <ArrowRight />}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}

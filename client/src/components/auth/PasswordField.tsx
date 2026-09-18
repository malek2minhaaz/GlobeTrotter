import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FieldError, Input, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { passwordStrength } from '@/lib/schemas';

/**
 * Password input with a show/hide toggle (Section 8).
 *
 * Forwarded ref so it drops straight into a React Hook Form `register()` spread.
 */
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    label: string;
    error?: string;
    hint?: string;
  }
>(({ id, label, error, hint, className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          ref={ref}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className="pr-10"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError id={errorId}>{error}</FieldError>
      {!error && hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
PasswordField.displayName = 'PasswordField';

/** Four-bar strength meter shown while choosing a password. */
export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;

  const tone =
    score <= 1
      ? 'bg-destructive'
      : score === 2
        ? 'bg-warning'
        : score === 3
          ? 'bg-primary'
          : 'bg-success';

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" role="img" aria-label={`Password strength: ${label}`}>
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              index < score ? tone : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: <span className="font-medium text-foreground">{label}</span> · use 8+ characters
        with a letter and a number
      </p>
    </div>
  );
}

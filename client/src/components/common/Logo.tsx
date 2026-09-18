import { Link } from 'react-router-dom';
import { Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The GlobeTrotter wordmark, used in every navigation surface. */
export function Logo({
  to = '/',
  className,
  showWordmark = true,
  size = 'md',
}: {
  to?: string;
  className?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-11' : 'size-9';
  const icon = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5';
  const text = size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <Link
      to={to}
      aria-label="GlobeTrotter home"
      className={cn('group inline-flex items-center gap-2.5 rounded-lg', className)}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground shadow-sm transition-transform group-hover:scale-105',
          box,
        )}
      >
        <Globe2 className={icon} aria-hidden="true" />
      </span>
      {showWordmark ? (
        <span className={cn('font-semibold tracking-tight', text)}>
          Globe<span className="text-primary">Trotter</span>
        </span>
      ) : null}
    </Link>
  );
}

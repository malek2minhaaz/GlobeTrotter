import * as React from 'react';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/lib/format';

/**
 * Image with a graceful fallback.
 *
 * Seeded travel imagery comes from remote URLs, and the app must still look
 * deliberate with no storage provider configured (Section 2) or when a remote
 * host is unreachable. A missing or broken image therefore becomes a
 * deterministic gradient plate carrying the subject's initials, rather than a
 * broken-image icon.
 */

const GRADIENTS = [
  'from-teal-500 to-emerald-700',
  'from-sky-500 to-indigo-700',
  'from-amber-500 to-rose-600',
  'from-violet-500 to-fuchsia-700',
  'from-cyan-500 to-blue-700',
  'from-lime-500 to-teal-700',
  'from-orange-500 to-red-700',
  'from-indigo-500 to-purple-800',
];

function gradientFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return GRADIENTS[hash % GRADIENTS.length]!;
}

interface SmartImageProps {
  src?: string | null;
  alt: string;
  /** Drives the fallback gradient and initials; defaults to `alt`. */
  seed?: string;
  className?: string;
  /** Set false for decorative images so screen readers skip them. */
  decorative?: boolean;
  loading?: 'lazy' | 'eager';
}

export function SmartImage({
  src,
  alt,
  seed,
  className,
  decorative = false,
  loading = 'lazy',
}: SmartImageProps) {
  const [failed, setFailed] = React.useState(false);

  // A new src deserves a fresh chance even if the previous one failed.
  React.useEffect(() => setFailed(false), [src]);

  const usable = Boolean(src) && !failed;
  const label = seed ?? alt;

  if (usable) {
    return (
      <img
        src={src!}
        alt={decorative ? '' : alt}
        aria-hidden={decorative || undefined}
        loading={loading}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn('object-cover', className)}
      />
    );
  }

  return (
    <div
      role={decorative ? 'presentation' : 'img'}
      aria-label={decorative ? undefined : alt}
      className={cn(
        'flex select-none items-center justify-center bg-gradient-to-br',
        gradientFor(label),
        className,
      )}
    >
      <span
        className="text-lg font-semibold tracking-wide text-white/90 drop-shadow-sm"
        aria-hidden="true"
      >
        {initialsOf(label) || 'GT'}
      </span>
    </div>
  );
}

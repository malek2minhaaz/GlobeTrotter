import { Outlet } from 'react-router-dom';
import { Compass, Sparkles, Wallet } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

const HIGHLIGHTS = [
  {
    icon: Compass,
    title: 'Multi-city itineraries',
    description: 'Chain destinations together and plan every day hour by hour.',
  },
  {
    icon: Wallet,
    title: 'Live budget tracking',
    description: 'See cost estimates by category before you book anything.',
  },
  {
    icon: Sparkles,
    title: 'Share in one click',
    description: 'Publish a clean itinerary page anyone can view or copy.',
  },
];

/**
 * Chrome for login, signup and password recovery.
 *
 * The brand panel doubles as a product explainer, so a first-time visitor learns
 * what GlobeTrotter does while they create an account.
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-8">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          GlobeTrotter keeps your plans private until you choose to share them.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-teal-700 to-emerald-900 lg:block">
        {/* Decorative only — the content below carries the meaning. */}
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <p className="max-w-sm text-3xl font-semibold leading-tight text-balance">
            Plan your journey.
            <br />
            Experience more.
          </p>

          <ul className="space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="max-w-xs text-sm text-primary-foreground/80">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <blockquote className="max-w-sm space-y-2 rounded-xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm italic text-primary-foreground/90">
              “I planned a nine-day trip through Rajasthan in a single evening — cities, sights and
              a budget I could actually stick to.”
            </p>
            <footer className="text-xs text-primary-foreground/70">
              Demo traveller · GlobeTrotter community
            </footer>
          </blockquote>
        </div>
      </aside>
    </div>
  );
}

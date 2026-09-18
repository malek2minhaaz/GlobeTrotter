import { Link, NavLink, Outlet } from 'react-router-dom';
import { Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const PUBLIC_LINKS = [
  { to: '/discover', label: 'Discover' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#features', label: 'Features' },
];

/** Chrome for the public site: landing, discovery, city and shared pages. */
export function PublicLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo />

          <nav aria-label="Public navigation" className="ml-6 hidden items-center gap-1 md:flex">
            {PUBLIC_LINKS.map((link) =>
              link.to.startsWith('/#') ? (
                <a
                  key={link.to}
                  href={link.to}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="flex-1" />
          <ThemeToggle />

          {isAuthenticated ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Start planning</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              A personalised travel planner for multi-city journeys — build day-by-day itineraries,
              discover experiences, track your budget and share the trip.
            </p>
            <p className="text-xs text-muted-foreground">
              React · TypeScript · Express · Prisma · PostgreSQL
            </p>
          </div>

          <FooterColumn
            title="Plan"
            links={[
              { to: '/trips/create', label: 'New trip' },
              { to: '/discover', label: 'Discover cities' },
              { to: '/saved', label: 'Saved destinations' },
            ]}
          />
          <FooterColumn
            title="Account"
            links={[
              { to: '/login', label: 'Sign in' },
              { to: '/signup', label: 'Create account' },
              { to: '/profile', label: 'Profile' },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { to: '/#features', label: 'Features' },
              { to: '/#how-it-works', label: 'How it works' },
              { to: '/discover', label: 'Explore' },
            ]}
          />
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p className="flex items-center gap-1.5">
              <Globe2 className="size-3.5" aria-hidden="true" />
              © {new Date().getFullYear()} GlobeTrotter. Built for travellers who plan.
            </p>
            <p>Prices shown are planning estimates and vary by season.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ to: string; label: string }> }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link
              to={link.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

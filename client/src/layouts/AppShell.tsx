import * as React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, SheetContent } from '@/components/ui/overlay';
import { UserAvatar } from '@/components/ui/misc';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { UserMenu } from '@/components/layout/UserMenu';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Application shell (Section 27).
 *
 * The sidebar is fixed on desktop and becomes a left drawer below `lg`; the top
 * bar stays sticky so account and notification controls are always reachable.
 * Both navigation surfaces render the same component, so they cannot diverge.
 */
export function AppShell() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const location = useLocation();

  // A route change should always start at the top of the new page.
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <div className="flex items-center justify-between gap-2 p-5">
        <Logo />
      </div>

      <div className="px-4 pb-4">
        <Button asChild className="w-full" onClick={onNavigate}>
          <Link to="/trips/create">
            <Plus />
            Plan new trip
          </Link>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        <SidebarNav onNavigate={onNavigate} />
      </div>

      {user ? (
        <div className="border-t border-border p-4">
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent"
          >
            <UserAvatar name={user.name} src={user.avatar} className="size-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        {sidebarBody()}
      </aside>

      {/* Mobile drawer */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" title="Navigation" className="flex flex-col gap-0 p-0">
          {sidebarBody(() => setDrawerOpen(false))}
        </SheetContent>
      </Dialog>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>

          <div className="lg:hidden">
            <Logo showWordmark size="sm" />
          </div>

          <div className="flex-1" />

          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

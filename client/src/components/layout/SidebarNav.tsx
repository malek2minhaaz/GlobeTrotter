import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bookmark,
  Compass,
  LayoutDashboard,
  Plane,
  Settings,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/trips', label: 'My Trips', icon: Plane, end: true },
  { to: '/discover', label: 'Discover Cities', icon: Compass },
  { to: '/saved', label: 'Saved Destinations', icon: Bookmark },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

/**
 * Sidebar navigation.
 *
 * Rendered once and reused by both the fixed desktop sidebar and the mobile
 * drawer, so the two can never drift apart (Section 27).
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : false}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )
          }
        >
          <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}

      {user?.role === 'ADMIN' ? (
        <NavLink
          to="/admin/analytics"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )
          }
        >
          <BarChart3 className="size-4.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Admin analytics</span>
        </NavLink>
      ) : null}
    </nav>
  );
}

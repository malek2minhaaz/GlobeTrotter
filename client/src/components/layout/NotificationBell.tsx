import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CalendarClock, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/feedback';
import { queryKeys } from '@/lib/queryClient';
import { dashboardService } from '@/services/workspace.service';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationSeverity } from '@/types/api';

const SEVERITY_META: Record<
  NotificationSeverity,
  { icon: typeof Info; className: string }
> = {
  info: { icon: Info, className: 'bg-primary/10 text-primary' },
  success: { icon: CheckCircle2, className: 'bg-success/15 text-success' },
  warning: { icon: TriangleAlert, className: 'bg-warning/20 text-warning' },
  danger: { icon: CalendarClock, className: 'bg-destructive/12 text-destructive' },
};

/**
 * In-app notifications (Section 43).
 *
 * These are derived server-side from the traveller's own data — a trip starting
 * soon, a budget exceeded, overlapping activities — so nothing here is invented
 * client-side.
 */
export function NotificationBell() {
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => dashboardService.notifications(10),
    staleTime: 60_000,
  });

  const notifications = notificationsQuery.data ?? [];
  const hasUnread = notifications.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={
          hasUnread ? `Notifications, ${notifications.length} new` : 'Notifications'
        }>
          {hasUnread ? <BellRing className="size-5" /> : <Bell className="size-5" />}
          {hasUnread ? (
            <span
              className="absolute right-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-background"
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-88 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {hasUnread ? (
            <span className="text-xs text-muted-foreground">{notifications.length} active</span>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto p-2 scrollbar-thin">
          {notificationsQuery.isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You are all caught up. We will let you know when a trip needs attention.
            </p>
          ) : (
            notifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const meta = SEVERITY_META[notification.severity];
  const Icon = meta.icon;

  const body = (
    <div className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-accent">
      <span
        className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', meta.className)}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium leading-tight">{notification.title}</p>
        <p className="text-xs text-muted-foreground">{notification.message}</p>
        {notification.actionLabel ? (
          <p className="pt-0.5 text-xs font-medium text-primary">{notification.actionLabel} →</p>
        ) : null}
      </div>
    </div>
  );

  if (notification.actionHref) {
    return (
      <Link to={notification.actionHref} className="block">
        {body}
      </Link>
    );
  }

  return body;
}

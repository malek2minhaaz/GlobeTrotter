import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconTooltip } from '@/components/ui/tooltip-checkbox';
import { useSavedCity } from '@/hooks/useSavedCity';
import { cn } from '@/lib/utils';

/** Bookmark toggle (Section 24). Signed-out visitors are routed to login. */
export function SaveCityButton({
  cityId,
  isSaved,
  cityName,
  variant = 'icon',
  className,
}: {
  cityId: string;
  isSaved: boolean;
  cityName: string;
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const { toggle, isPending } = useSavedCity();
  const label = isSaved ? `Remove ${cityName} from saved destinations` : `Save ${cityName}`;

  if (variant === 'full') {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => toggle(cityId, isSaved)}
        className={className}
        aria-pressed={isSaved}
      >
        {isSaved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
        {isSaved ? 'Saved' : 'Save'}
      </Button>
    );
  }

  return (
    <IconTooltip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle(cityId, isSaved);
        }}
        aria-label={label}
        aria-pressed={isSaved}
        className={cn('bg-background/85 backdrop-blur-sm hover:bg-background', className)}
      >
        {isSaved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
      </Button>
    </IconTooltip>
  );
}

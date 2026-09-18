import * as React from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, Globe2, Lock, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator, Switch } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/overlay';
import { toast } from '@/lib/toast';
import { useTripMutations } from '@/hooks/useTripMutations';
import type { TripDetail } from '@/types/api';

/**
 * Public sharing (Section 20).
 *
 * Sharing is an explicit, reversible toggle. While a trip is private there is no
 * link to copy and the public page is not reachable, so the dialog always states
 * which state you are in rather than leaving a stale URL on screen.
 */
export function ShareTripDialog({
  trip,
  trigger,
}: {
  trip: TripDetail;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const { shareTrip } = useTripMutations();

  const shareUrl =
    trip.isPublic && trip.publicSlug
      ? `${window.location.origin}/shared/${trip.publicSlug}`
      : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied', 'Paste it anywhere to share your itinerary.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('We could not copy the link', 'Select the address and copy it manually.');
    }
  };

  const webShare = async () => {
    if (!shareUrl) return;
    // Not supported everywhere, so fall back to copying rather than failing silently.
    if (typeof navigator.share !== 'function') {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: trip.name,
        text: `Take a look at my trip: ${trip.name}`,
        url: shareUrl,
      });
    } catch {
      // A cancelled share sheet is not an error worth reporting.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Share2 />
            Share
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{trip.name}”</DialogTitle>
          <DialogDescription>
            Public trips are readable by anyone with the link. Your email address and account
            details are never shown on the shared page.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              {trip.isPublic ? (
                <>
                  <Globe2 className="size-4 text-primary" aria-hidden="true" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                  Private
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {trip.isPublic
                ? 'Anyone with the link can view and copy this itinerary.'
                : 'Only you can see this trip right now.'}
            </p>
          </div>
          <Switch
            checked={trip.isPublic}
            disabled={shareTrip.isPending}
            onCheckedChange={(checked) => shareTrip.mutate({ tripId: trip.id, isPublic: checked })}
            aria-label={trip.isPublic ? 'Make trip private' : 'Make trip public'}
          />
        </div>

        {shareUrl ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Share link</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
                  {shareUrl}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => void copyLink()}
                  aria-label="Copy share link"
                >
                  {copied ? <Check className="text-success" /> : <Copy />}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copyLink()}>
                {copied ? <Check /> : <Copy />}
                Copy link
              </Button>
              <Button type="button" variant="outline" onClick={() => void webShare()}>
                <Share2 />
                Share…
              </Button>
              <Button asChild variant="ghost">
                <Link to={`/shared/${trip.publicSlug}`} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Preview page
                </Link>
              </Button>
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{trip.viewCount} views</Badge>
              Turn sharing off at any time — the link stops working immediately.
            </p>
          </>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            Turn on sharing to generate a unique link for this itinerary.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

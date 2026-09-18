import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { PendingConflict } from '@/hooks/useAddItineraryItem';

/**
 * Overlap resolution (Section 15).
 *
 * The traveller is told exactly what clashes and how to fix it, then chooses:
 * keep the overlap deliberately, or go back and adjust the times.
 */
export function ConflictResolutionDialog({
  conflict,
  onDismiss,
  onConfirm,
}: {
  conflict: PendingConflict | null;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={Boolean(conflict)}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      title="This activity overlaps another"
      description={
        <div className="space-y-2">
          <p>{conflict?.message}</p>
          {conflict && conflict.conflicts.length > 0 ? (
            <ul className="list-inside list-disc space-y-1 text-xs">
              {conflict.conflicts.map((entry, index) => (
                <li key={index}>{entry.resolution}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs">
            Add it anyway and resolve the clash later, or cancel and adjust the times.
          </p>
        </div>
      }
      confirmLabel="Add anyway"
      cancelLabel="Let me adjust"
      onConfirm={onConfirm}
    />
  );
}

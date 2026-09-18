import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACTIVITY_CATEGORIES } from '@/lib/categoryMeta';
import { itineraryItemSchema, type ItineraryItemForm } from '@/lib/schemas';
import { formatDateRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ItineraryItem } from '@/types/api';

/**
 * Edit an itinerary entry (Section 13).
 *
 * Time, notes and an optional custom cost are all editable, so a traveller can
 * replace an activity's catalogue estimate with what they actually expect to pay.
 */
export function ItineraryItemDialog({
  item,
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  saving,
  deleting,
  minDate,
  maxDate,
}: {
  item: ItineraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ItineraryItemForm) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  minDate: string;
  maxDate: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ItineraryItemForm>({
    resolver: zodResolver(itineraryItemSchema),
    defaultValues: {
      date: minDate,
      startTime: '09:00',
      endTime: '',
      notes: '',
      customCost: '',
      category: '',
      title: '',
      activityId: '',
    },
  });

  // Reload the form whenever a different entry is opened.
  React.useEffect(() => {
    if (!item) return;
    reset({
      activityId: item.activityId ?? '',
      title: item.title,
      category: item.category ?? '',
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime ?? '',
      notes: item.notes ?? '',
      customCost: item.customCost === null ? '' : String(item.customCost),
      allowOverlap: true,
    });
  }, [item, reset]);

  const category = watch('category');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit activity</DialogTitle>
          <DialogDescription>
            Change the time, shift it to another day, add notes or set what you expect it to cost.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="item-title">Title</Label>
            <Input id="item-title" {...register('title')} />
            <FieldError>{errors.title?.message}</FieldError>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-date">Date</Label>
              <Input
                id="item-date"
                type="date"
                min={minDate}
                max={maxDate}
                {...register('date')}
              />
              <FieldError>{errors.date?.message}</FieldError>
              <FieldHint>Must fall inside your trip dates.</FieldHint>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-category">Category</Label>
              <Select
                value={category || 'NONE'}
                onValueChange={(value) =>
                  setValue('category', value === 'NONE' ? '' : value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="item-category">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No category</SelectItem>
                  {ACTIVITY_CATEGORIES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-start">Start time</Label>
              <Input id="item-start" type="time" {...register('startTime')} />
              <FieldError>{errors.startTime?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-end">End time</Label>
              <Input id="item-end" type="time" {...register('endTime')} />
              <FieldError>{errors.endTime?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-cost">Custom cost</Label>
              <Input
                id="item-cost"
                type="number"
                min={0}
                step={100}
                placeholder={item?.activity ? String(item.activity.estimatedCost) : '0'}
                {...register('customCost')}
              />
              <FieldError>{errors.customCost?.message}</FieldError>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-notes">Notes</Label>
            <Textarea
              id="item-notes"
              placeholder="Book tickets in advance · meet at the north gate"
              className={cn('min-h-[72px]')}
              {...register('notes')}
            />
            <FieldError>{errors.notes?.message}</FieldError>
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              loading={deleting}
              onClick={onDelete}
            >
              <Trash2 />
              Remove
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </form>

        {item ? (
          <p className="text-xs text-muted-foreground">
            Currently scheduled for {formatDateRange(item.date, item.date)} at {item.startTime}.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

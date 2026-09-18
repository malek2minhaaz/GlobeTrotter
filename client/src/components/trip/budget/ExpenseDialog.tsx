import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES } from '@/lib/categoryMeta';
import { expenseSchema, type ExpenseForm } from '@/lib/schemas';
import { todayISODate } from '@/lib/format';
import type { Expense, ExpenseCategory } from '@/types/api';

/**
 * Add or edit an expense (Section 17).
 *
 * Manual expenses are what make the budget real rather than theoretical, so this
 * is the one place category, amount and date are entered by hand.
 */
export function ExpenseDialog({
  travelDates,
  expense,
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  saving,
  deleting,
  currency,
}: {
  /** Trip date range, so an expense can never fall outside the journey. */
  travelDates: { start: string; end: string };
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ExpenseForm) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  currency: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: 'ACCOMMODATION',
      amount: '',
      description: '',
      date: todayISODate(),
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (expense) {
      reset({
        category: expense.category,
        amount: String(expense.amount),
        description: expense.description,
        date: expense.date,
      });
      return;
    }
    reset({
      category: 'ACCOMMODATION',
      amount: '',
      description: '',
      date: travelDates.start,
    });
  }, [open, expense, reset, travelDates.start]);

  const category = watch('category');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit expense' : 'Add an expense'}</DialogTitle>
          <DialogDescription>
            Expenses added here sit alongside your activity estimates in the budget totals.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="expense-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) =>
                setValue('category', value as ExpenseCategory, { shouldDirty: true })
              }
            >
              <SelectTrigger id="expense-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Amount ({currency})</Label>
              <Input
                id="expense-amount"
                type="number"
                min={0}
                step={100}
                inputMode="decimal"
                placeholder="5000"
                aria-invalid={errors.amount ? true : undefined}
                {...register('amount')}
              />
              <FieldError>{errors.amount?.message}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                min={travelDates.start}
                max={travelDates.end}
                {...register('date')}
              />
              <FieldError>{errors.date?.message}</FieldError>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              placeholder="Hotel booking — 3 nights"
              aria-invalid={errors.description ? true : undefined}
              {...register('description')}
            />
            <FieldError>{errors.description?.message}</FieldError>
            <FieldHint>Something you will recognise later in the list.</FieldHint>
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            {expense ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                loading={deleting}
                onClick={onDelete}
              >
                <Trash2 />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {expense ? 'Save expense' : 'Add expense'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

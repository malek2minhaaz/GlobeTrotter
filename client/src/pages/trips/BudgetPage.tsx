import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Pencil,
  Plus,
  Receipt,
  Target,
  TrendingUp,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Input, Label, FieldHint } from '@/components/ui/input';
import { Progress, Separator } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlay';
import { BudgetSkeleton } from '@/components/common/Skeletons';
import { ExpenseDialog } from '@/components/trip/budget/ExpenseDialog';
import { queryKeys } from '@/lib/queryClient';
import { tripsService } from '@/services/trips.service';
import { toast } from '@/lib/toast';
import { expenseCategoryIcon, expenseCategoryLabel } from '@/lib/categoryMeta';
import { formatCurrency, formatDate, pluralise } from '@/lib/format';
import { useTripWorkspace } from '@/layouts/TripWorkspaceLayout';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types/api';
import type { ExpenseForm } from '@/lib/schemas';

/**
 * Budget management (Sections 17, 18 and 39).
 *
 * The API does all the arithmetic — totals, per-category slices, per-day series
 * and the day-level statistics — so this page renders figures rather than
 * recomputing them, and the numbers always agree with the itinerary.
 */
export default function BudgetPage() {
  const { trip, currency } = useTripWorkspace();
  const queryClient = useQueryClient();

  const [expenseDialog, setExpenseDialog] = React.useState<{ open: boolean; expense: Expense | null }>({
    open: false,
    expense: null,
  });
  const [limitOpen, setLimitOpen] = React.useState(false);
  const [limitDraft, setLimitDraft] = React.useState('');
  const [limitError, setLimitError] = React.useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = React.useState<Expense | null>(null);

  const budgetQuery = useQuery({
    queryKey: queryKeys.tripBudget(trip.id),
    queryFn: () => tripsService.budget(trip.id),
  });

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripBudget(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: ['trips'] });
  }, [queryClient, trip.id]);

  const saveExpense = useMutation({
    mutationFn: ({ expense, values }: { expense: Expense | null; values: ExpenseForm }) => {
      const payload = {
        category: values.category,
        amount: Number(values.amount),
        description: values.description,
        date: values.date,
      };
      return expense
        ? tripsService.updateExpense(expense.id, payload)
        : tripsService.addExpense(trip.id, payload);
    },
    onSuccess: (_result, variables) => {
      invalidate();
      setExpenseDialog({ open: false, expense: null });
      toast.success(variables.expense ? 'Expense updated' : 'Expense added');
    },
    onError: (error) => toast.fromError(error, 'We could not save that expense.'),
  });

  const deleteExpense = useMutation({
    mutationFn: (expenseId: string) => tripsService.removeExpense(expenseId),
    onSuccess: () => {
      invalidate();
      setExpenseToDelete(null);
      setExpenseDialog({ open: false, expense: null });
      toast.info('Expense deleted');
    },
    onError: (error) => toast.fromError(error, 'We could not delete that expense.'),
  });

  const saveLimit = useMutation({
    mutationFn: (budgetLimit: number | null) => tripsService.update(trip.id, { budgetLimit }),
    onSuccess: () => {
      invalidate();
      setLimitOpen(false);
      toast.success('Budget updated');
    },
    onError: (error) => toast.fromError(error, 'We could not update your budget.'),
  });

  if (budgetQuery.isLoading) {
    return <BudgetSkeleton />;
  }

  if (budgetQuery.isError || !budgetQuery.data) {
    return (
      <ErrorState
        title="We could not load the budget"
        message="Your expenses are safe — this is just a problem fetching the totals."
        onRetry={() => void budgetQuery.refetch()}
      />
    );
  }

  const budget = budgetQuery.data;
  const { stats } = budget;
  // The most recent two weeks keep the axis readable on longer trips.
  const chartDays = budget.perDay.slice(-14);

  const openLimitDialog = () => {
    setLimitDraft(budget.budgetLimit === null ? '' : String(budget.budgetLimit));
    setLimitError(null);
    setLimitOpen(true);
  };

  const submitLimit = () => {
    if (limitDraft.trim() === '') {
      saveLimit.mutate(null);
      return;
    }
    const value = Number(limitDraft);
    if (Number.isNaN(value) || value < 0) {
      setLimitError('Enter a valid amount, or leave it blank to remove the limit.');
      return;
    }
    saveLimit.mutate(value);
  };

  return (
    <>
      <div className="space-y-6">
        {/* ── Total + alert ── */}
        <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4 rounded-xl border border-border bg-gradient-to-br from-primary/8 via-card to-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Total estimated cost
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {formatCurrency(budget.total, currency)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pluralise(budget.totalDays, 'day')} ·{' '}
                  {pluralise(stats.activityCount, 'planned activity', 'planned activities')} ·{' '}
                  {pluralise(stats.expenseCount, 'logged expense')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={openLimitDialog}>
                <Target />
                {budget.budgetLimit === null ? 'Set budget' : 'Edit budget'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatBox
                label="From activities"
                value={formatCurrency(budget.planned, currency)}
                icon={Receipt}
              />
              <StatBox
                label="From expenses"
                value={formatCurrency(budget.logged, currency)}
                icon={Wallet}
              />
              <StatBox
                label="Average per day"
                value={formatCurrency(stats.averagePerDay, currency)}
                icon={TrendingUp}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Budget status</h2>

            {budget.budgetLimit === null ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You have not set a limit for this trip. Setting one lets GlobeTrotter warn you
                  before you overspend.
                </p>
                <Button variant="outline" size="sm" onClick={openLimitDialog}>
                  <Target />
                  Set a budget
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(budget.total, currency)} of{' '}
                    {formatCurrency(budget.budgetLimit, currency)}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      budget.isOverBudget ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {budget.usedPercent}%
                  </span>
                </div>
                <Progress
                  value={budget.usedPercent ?? 0}
                  indicatorClassName={budget.isOverBudget ? 'bg-destructive' : undefined}
                />
                {budget.isOverBudget ? (
                  <p
                    role="alert"
                    className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                  >
                    ⚠️ Your estimated trip cost is{' '}
                    {formatCurrency(budget.overBudgetBy, currency)} above your budget.
                  </p>
                ) : (
                  <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                    {formatCurrency(budget.remaining ?? 0, currency)} still available.
                  </p>
                )}
                <Button variant="ghost" size="sm" onClick={openLimitDialog}>
                  <Pencil />
                  Change limit
                </Button>
              </div>
            )}

            <Separator />

            <dl className="space-y-2 text-sm">
              <StatRow
                label="Highest spending day"
                value={
                  stats.highestDay
                    ? `${formatDate(stats.highestDay.date, 'd MMM')} · ${formatCurrency(stats.highestDay.total, currency)}`
                    : '—'
                }
                icon={ArrowUpRight}
              />
              <StatRow
                label="Cheapest day"
                value={
                  stats.cheapestDay
                    ? `${formatDate(stats.cheapestDay.date, 'd MMM')} · ${formatCurrency(stats.cheapestDay.total, currency)}`
                    : '—'
                }
                icon={ArrowDownRight}
              />
              <StatRow
                label="Average on spending days"
                value={formatCurrency(stats.averagePerSpendDay, currency)}
                icon={CalendarDays}
              />
            </dl>
          </div>
        </section>

        {/* ── Charts ── */}
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold">Where the money goes</h2>
              <p className="text-xs text-muted-foreground">
                Split across the five budget categories
              </p>
            </div>
            {budget.categories.every((slice) => slice.amount === 0) ? (
              <EmptyState
                icon={Wallet}
                title="Nothing to chart yet"
                description="Add activities or an expense and the breakdown will appear here."
                className="py-10"
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={budget.categories.filter((slice) => slice.amount > 0)}
                      dataKey="amount"
                      nameKey="label"
                      innerRadius="52%"
                      outerRadius="80%"
                      paddingAngle={2}
                      stroke="var(--card)"
                    >
                      {budget.categories
                        .filter((slice) => slice.amount > 0)
                        .map((slice) => (
                          <Cell key={slice.category} fill={slice.colour} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, currency)}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--popover)',
                        color: 'var(--popover-foreground)',
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value: string) => (
                        <span className="text-xs text-muted-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold">Cost by day</h2>
              <p className="text-xs text-muted-foreground">
                Activities and logged expenses for each day of the trip
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDays} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: string) => formatDate(value, 'd MMM')}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) =>
                      Intl.NumberFormat('en-IN', { notation: 'compact' }).format(value)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                    labelFormatter={(value: string) => formatDate(value, 'EEE d MMM')}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value, currency),
                      name === 'planned' ? 'Activities' : 'Expenses',
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="planned" stackId="cost" fill="var(--primary)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="logged" stackId="cost" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ── Categories ── */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Categories</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {budget.categories.map((slice) => {
              const Icon = expenseCategoryIcon(slice.category);
              return (
                <div
                  key={slice.category}
                  className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${slice.colour}22`, color: slice.colour }}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium">{slice.label}</span>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(slice.amount, currency)}</p>
                  <div className="space-y-1.5">
                    <Progress
                      value={slice.percent}
                      className="h-1.5"
                      indicatorClassName="bg-current"
                      style={{ color: slice.colour }}
                    />
                    <p className="text-xs text-muted-foreground">{slice.percent}% of the total</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Expenses ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Logged expenses</h2>
              <p className="text-xs text-muted-foreground">
                Bookings and payments you have actually made
              </p>
            </div>
            <Button onClick={() => setExpenseDialog({ open: true, expense: null })}>
              <Plus />
              Add expense
            </Button>
          </div>

          {budget.expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description="Track hotels, flights and meals here to see how your estimate compares with reality."
              action={
                <Button onClick={() => setExpenseDialog({ open: true, expense: null })}>
                  <Plus />
                  Add your first expense
                </Button>
              }
            />
          ) : (
            <>
              {/* Table on wider screens, cards on mobile. */}
              <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Expenses logged for this trip</caption>
                  <thead className="bg-muted/50">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-medium">
                        Description
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Category
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {budget.expenses.map((expense) => {
                      const Icon = expenseCategoryIcon(expense.category);
                      return (
                        <tr key={expense.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-medium">{expense.description}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">
                              <Icon aria-hidden="true" />
                              {expenseCategoryLabel(expense.category)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(expense.date)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(expense.amount, currency)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setExpenseDialog({ open: true, expense })}
                                aria-label={`Edit ${expense.description}`}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setExpenseToDelete(expense)}
                                aria-label={`Delete ${expense.description}`}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/40">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-medium">
                        Total logged
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(budget.logged, currency)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {budget.expenses.map((expense) => {
                  const Icon = expenseCategoryIcon(expense.category);
                  return (
                    <li
                      key={expense.id}
                      className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{expense.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(expense.date)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold">
                          {formatCurrency(expense.amount, currency)}
                        </span>
                      </div>
                      <Badge variant="secondary">
                        <Icon aria-hidden="true" />
                        {expenseCategoryLabel(expense.category)}
                      </Badge>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setExpenseDialog({ open: true, expense })}
                        >
                          <Pencil />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setExpenseToDelete(expense)}
                        >
                          <Trash2 />
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* ── Dialogs ── */}
      <ExpenseDialog
        travelDates={{ start: trip.startDate, end: trip.endDate }}
        expense={expenseDialog.expense}
        open={expenseDialog.open}
        onOpenChange={(open) => setExpenseDialog({ open, expense: open ? expenseDialog.expense : null })}
        currency={currency}
        saving={saveExpense.isPending}
        deleting={deleteExpense.isPending}
        onSubmit={(values) => saveExpense.mutate({ expense: expenseDialog.expense, values })}
        onDelete={() => {
          if (expenseDialog.expense) deleteExpense.mutate(expenseDialog.expense.id);
        }}
      />

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Trip budget</DialogTitle>
            <DialogDescription>
              Set a limit for the whole trip. Leave it blank to stop tracking one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="budget-limit">Budget ({currency})</Label>
            <Input
              id="budget-limit"
              type="number"
              min={0}
              step={500}
              value={limitDraft}
              onChange={(event) => setLimitDraft(event.target.value)}
              placeholder="e.g. 45000"
            />
            {limitError ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {limitError}
              </p>
            ) : (
              <FieldHint>
                Current estimate is {formatCurrency(budget.total, currency)}.
              </FieldHint>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitOpen(false)}>
              Cancel
            </Button>
            <Button loading={saveLimit.isPending} onClick={submitLimit}>
              Save budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(expenseToDelete)}
        onOpenChange={(open) => {
          if (!open) setExpenseToDelete(null);
        }}
        destructive
        loading={deleteExpense.isPending}
        title="Delete this expense?"
        description={`“${expenseToDelete?.description ?? 'This expense'}” will be removed and the totals recalculated.`}
        confirmLabel="Delete expense"
        onConfirm={() => expenseToDelete && deleteExpense.mutate(expenseToDelete.id)}
      />
    </>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="space-y-0.5 rounded-lg border border-border/70 bg-card/60 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}


import {
  Bed,
  Building2,
  Camera,
  Compass,
  Landmark,
  Mountain,
  Palette,
  ShoppingBag,
  Sparkles,
  Ticket,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityCategory, ExpenseCategory } from '@/types/api';

/** Labels and icons for activity categories, shared by every activity surface. */
export const ACTIVITY_CATEGORIES: Array<{
  value: ActivityCategory;
  label: string;
  icon: LucideIcon;
}> = [
  { value: 'ADVENTURE', label: 'Adventure', icon: Mountain },
  { value: 'SIGHTSEEING', label: 'Sightseeing', icon: Camera },
  { value: 'FOOD', label: 'Food', icon: UtensilsCrossed },
  { value: 'CULTURE', label: 'Culture', icon: Landmark },
  { value: 'SHOPPING', label: 'Shopping', icon: ShoppingBag },
  { value: 'NATURE', label: 'Nature', icon: Waves },
  { value: 'ENTERTAINMENT', label: 'Entertainment', icon: Ticket },
  { value: 'RELAXATION', label: 'Relaxation', icon: Sparkles },
];

const ACTIVITY_MAP = new Map(ACTIVITY_CATEGORIES.map((entry) => [entry.value, entry]));

export function activityCategoryLabel(category: ActivityCategory | null | undefined): string {
  if (!category) return 'Activity';
  return ACTIVITY_MAP.get(category)?.label ?? 'Activity';
}

export function activityCategoryIcon(category: ActivityCategory | null | undefined): LucideIcon {
  if (!category) return Compass;
  return ACTIVITY_MAP.get(category)?.icon ?? Compass;
}

/** Order matches the budget page so charts and tables line up. */
export const EXPENSE_CATEGORIES: Array<{
  value: ExpenseCategory;
  label: string;
  icon: LucideIcon;
  /** Fallback colour; the API supplies its own so server and client agree. */
  colour: string;
}> = [
  { value: 'TRANSPORT', label: 'Transportation', icon: Compass, colour: '#0ea5e9' },
  { value: 'ACCOMMODATION', label: 'Accommodation', icon: Bed, colour: '#14b8a6' },
  { value: 'ACTIVITIES', label: 'Activities', icon: Ticket, colour: '#f59e0b' },
  { value: 'MEALS', label: 'Meals', icon: UtensilsCrossed, colour: '#f43f5e' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous', icon: Palette, colour: '#8b5cf6' },
];

const EXPENSE_MAP = new Map(EXPENSE_CATEGORIES.map((entry) => [entry.value, entry]));

export function expenseCategoryLabel(category: ExpenseCategory): string {
  return EXPENSE_MAP.get(category)?.label ?? 'Other';
}

export function expenseCategoryIcon(category: ExpenseCategory): LucideIcon {
  return EXPENSE_MAP.get(category)?.icon ?? Building2;
}

export function expenseCategoryColour(category: ExpenseCategory): string {
  return EXPENSE_MAP.get(category)?.colour ?? '#64748b';
}

/** Copy for the trip status pill, consistent everywhere it appears. */
export const TRIP_STATUS_META = {
  UPCOMING: { label: 'Upcoming', tone: 'default' as const },
  ONGOING: { label: 'Ongoing', tone: 'success' as const },
  COMPLETED: { label: 'Completed', tone: 'secondary' as const },
};

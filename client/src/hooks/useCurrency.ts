import { useAuth } from '@/contexts/AuthContext';

/**
 * Currency for formatting costs.
 *
 * The profile stores the preference; signed-out visitors fall back to the same
 * default the seed data is priced in, so public itinerary pages read correctly.
 */
export function useCurrency(): string {
  const { user } = useAuth();
  return user?.currency ?? 'INR';
}

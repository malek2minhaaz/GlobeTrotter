import { z } from 'zod';
import { emailSchema, languageSchema, optionalUrlSchema } from './common.validators';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your full name.').max(120).optional(),
    email: emailSchema.optional(),
    avatar: optionalUrlSchema,
    language: languageSchema.optional(),
    currency: z
      .string()
      .trim()
      .length(3, 'Use a 3-letter currency code such as INR or USD.')
      .toUpperCase()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nothing to update.',
  });

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    tripsPublicByDefault: z.boolean().optional(),
    notifyUpcomingTrips: z.boolean().optional(),
    notifyBudgetAlerts: z.boolean().optional(),
    notifyItineraryConflicts: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nothing to update.',
  });

/**
 * Account deletion requires the current password *and* a typed confirmation, so
 * a stray click can never destroy an account.
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm.'),
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Type DELETE to confirm.' }),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

import { z } from 'zod';

/**
 * Client-side form schemas.
 *
 * These mirror the server validators so a traveller gets immediate feedback, but
 * they are a convenience only — the API re-validates everything it receives.
 */

export const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address.');

/** Matches the API rule: at least 8 characters with a letter and a number. */
export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[A-Za-z]/, 'Password must include at least one letter.')
  .regex(/\d/, 'Password must include at least one number.');

export const optionalUrlField = z
  .string()
  .trim()
  .url('Enter a valid URL (including https://).')
  .max(600, 'That URL is too long.')
  .optional()
  .or(z.literal(''));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
  rememberMe: z.boolean(),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name.').max(120),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    avatar: optionalUrlField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type SignupForm = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(10, 'This reset link is not valid.'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

// ── Trips ────────────────────────────────────────────────────────────────────

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.');
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use a 24-hour time.');

export const tripDetailsSchema = z
  .object({
    name: z.string().trim().min(3, 'Give your trip a name.').max(120),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    coverImage: z.string().trim().max(600).optional().or(z.literal('')),
    startDate: dateOnly,
    endDate: dateOnly,
    isPublic: z.boolean(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'The end date cannot be before the start date.',
    path: ['endDate'],
  });
export type TripDetailsForm = z.infer<typeof tripDetailsSchema>;

export const itineraryItemSchema = z
  .object({
    activityId: z.string().optional().or(z.literal('')),
    title: z.string().trim().max(160).optional().or(z.literal('')),
    category: z.string().optional().or(z.literal('')),
    date: dateOnly,
    startTime: timeOnly,
    endTime: z.union([timeOnly, z.literal('')]).optional(),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
    // A number input yields a string; empty means "use the activity estimate".
    customCost: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          value === undefined ||
          value === '' ||
          (!Number.isNaN(Number(value)) && Number(value) >= 0),
        { message: 'Enter a valid amount, or leave it blank.' },
      ),
    allowOverlap: z.boolean().optional(),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'The end time must be after the start time.',
    path: ['endTime'],
  })
  .refine((data) => Boolean(data.activityId || data.title), {
    message: 'Choose an activity or enter a title.',
    path: ['title'],
  });
export type ItineraryItemForm = z.infer<typeof itineraryItemSchema>;

export const expenseSchema = z.object({
  category: z.enum(['TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES', 'MEALS', 'MISCELLANEOUS']),
  // Held as a string because that is what a number input produces; converted when
  // the expense is submitted.
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount.')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, {
      message: 'Enter an amount greater than zero.',
    }),
  description: z.string().trim().min(2, 'Describe this expense.').max(200),
  date: dateOnly,
});
export type ExpenseForm = z.infer<typeof expenseSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: emailField,
  avatar: optionalUrlField,
  language: z.string().min(2),
  currency: z.string().min(3),
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const deleteAccountSchema = z
  .object({
    password: z.string().min(1, 'Enter your password.'),
    confirmation: z.string(),
  })
  .refine((data) => data.confirmation === 'DELETE', {
    message: 'Type DELETE exactly to confirm.',
    path: ['confirmation'],
  });
export type DeleteAccountForm = z.infer<typeof deleteAccountSchema>;

/** Rough strength score (0–4) used by the signup meter. */
export function passwordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: 'Enter a password' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score: Math.min(score, 4), label: labels[Math.min(score, 4)]! };
}

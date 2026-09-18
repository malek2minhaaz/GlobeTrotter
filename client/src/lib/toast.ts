import { toast as sonner } from 'sonner';
import { ApiError } from './api';

/**
 * Toast helpers (Section 32).
 *
 * Every mutation result goes through here so success and failure copy stays
 * consistent, and so an `ApiError` message is shown verbatim while anything
 * unexpected falls back to a friendly line.
 */
export const toast = {
  success(message: string, description?: string) {
    sonner.success(message, { description });
  },

  error(message: string, description?: string) {
    sonner.error(message, { description });
  },

  info(message: string, description?: string) {
    sonner.info(message, { description });
  },

  warning(message: string, description?: string) {
    sonner.warning(message, { description });
  },

  message(message: string, description?: string) {
    sonner(message, { description });
  },

  /** Renders an unknown thrown value as a toast — safe for any catch block. */
  fromError(error: unknown, fallback = 'Something went wrong. Please try again.') {
    const message = error instanceof ApiError ? error.message : fallback;
    const description =
      error instanceof ApiError && error.isNetworkError
        ? 'Your changes were not saved.'
        : undefined;
    sonner.error(message, { description });
  },

  /** Reports field errors from a 422 next to the toast, sparing the summary. */
  fromFormError(error: unknown, fallback = 'Please check the highlighted fields.') {
    if (error instanceof ApiError && error.isValidationError) {
      sonner.error(error.message || fallback);
      return;
    }
    toast.fromError(error);
  },
};

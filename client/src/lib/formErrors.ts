import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/**
 * Maps a 422 response onto React Hook Form fields.
 *
 * Server validation is the authority, so its per-field messages are pushed onto
 * the matching inputs. Anything the form does not render is ignored rather than
 * silently attached to an invisible field.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  knownFields?: ReadonlyArray<Path<T>>,
): boolean {
  if (!(error instanceof ApiError) || !error.isValidationError) return false;

  let applied = false;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];
    if (!message) continue;
    if (knownFields && !knownFields.includes(field as Path<T>)) continue;
    setError(field as Path<T>, { type: 'server', message });
    applied = true;
  }
  return applied;
}

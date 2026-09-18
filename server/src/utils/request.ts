import type { Request } from 'express';
import { ApiError } from './ApiError';

/**
 * Reads a route parameter as a plain string.
 *
 * Express 5 types parameter values as `string | string[]` because a pattern can
 * match repeatedly. Every route in this app uses a single named segment, so this
 * narrows the type once, in one place, instead of scattering casts through the
 * controllers — and it fails loudly if a route is ever mis-declared.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
    return value[0];
  }
  throw ApiError.badRequest(`Missing "${name}" in the request path.`);
}

import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

/**
 * Rate limits are disabled under test so a fast test suite does not trip them.
 * Limits are generous enough for real use but blunt credential stuffing.
 */
function build(options: { windowMs: number; limit: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, res) => {
      res.status(429).json({ error: { message: options.message, code: 'RATE_LIMITED' } });
    },
  });
}

/** Broad protection for the whole API surface. */
export const apiLimiter = build({
  windowMs: 60_000,
  limit: 300,
  message: 'Too many requests. Please slow down for a moment.',
});

/** Tight limit on credential endpoints — login, register, password reset. */
export const authLimiter = build({
  windowMs: 15 * 60_000,
  limit: 25,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

/** Writes (creating trips, activities, expenses) are cheap but abusable. */
export const writeLimiter = build({
  windowMs: 60_000,
  limit: 120,
  message: 'You are making changes very quickly. Please pause briefly.',
});

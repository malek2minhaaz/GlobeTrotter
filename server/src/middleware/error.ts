import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { ApiError } from '../utils/ApiError';

/** Unmatched route → 404 in the same envelope as every other error. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `No API route matches ${req.method} ${req.originalUrl}.`,
      code: 'NOT_FOUND',
    },
  });
};

interface ErrorEnvelope {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

/**
 * The single place that turns a thrown value into a response.
 *
 * Internal details (Prisma messages, stack traces) are logged but never sent to
 * the client — users get a friendly message instead (Section 31).
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our end. Please try again.';
  let details: unknown;

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = error.issues[0]?.message ?? 'Some fields need your attention.';
    details = error.issues.reduce<Record<string, string[]>>((acc, issue) => {
      const key = issue.path.join('.') || '_';
      acc[key] = [...(acc[key] ?? []), issue.message];
      return acc;
    }, {});
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        status = 409;
        code = 'DUPLICATE';
        const target = (error.meta?.target as string[] | string | undefined) ?? 'value';
        const field = Array.isArray(target) ? target.join(', ') : target;
        message = `That ${field} is already in use.`;
        break;
      }
      case 'P2025':
        status = 404;
        code = 'NOT_FOUND';
        message = 'The requested resource no longer exists.';
        break;
      case 'P2003':
        status = 400;
        code = 'INVALID_REFERENCE';
        message = 'That record references something that does not exist.';
        break;
      case 'P2014':
        status = 400;
        code = 'INVALID_REFERENCE';
        message = 'That change would break an existing relationship.';
        break;
      default:
        status = 400;
        code = 'DATABASE_ERROR';
        message = 'The database rejected that request.';
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    status = 400;
    code = 'DATABASE_ERROR';
    message = 'The request contained data the database could not accept.';
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'We cannot reach the database right now. Please try again shortly.';
  } else if (error instanceof SyntaxError && 'body' in error) {
    // body-parser rejects malformed JSON with a SyntaxError carrying a status.
    status = 400;
    code = 'MALFORMED_JSON';
    message = 'The request body was not valid JSON.';
  } else if (
    typeof (error as { status?: unknown })?.status === 'number' &&
    (error as { status: number }).status >= 400 &&
    (error as { status: number }).status < 500
  ) {
    status = (error as { status: number }).status;
    code = 'BAD_REQUEST';
    message = 'That request could not be processed.';
  }

  // Always log the real error server-side so debugging stays possible.
  if (status >= 500) {
    console.error('[error]', error);
  } else if (!isProduction) {
    console.warn(`[error] ${status} ${code}: ${message}`);
  }

  const body: ErrorEnvelope = { error: { message, code } };
  if (details !== undefined) body.error.details = details;

  res.status(status).json(body);
};

export default errorHandler;

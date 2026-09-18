import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Flattens a ZodError into `{ field: [messages] }` for form-level display. */
function fieldErrors(error: ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((acc, issue) => {
    const key = issue.path.join('.') || '_';
    acc[key] = [...(acc[key] ?? []), issue.message];
    return acc;
  }, {});
}

/**
 * Validates and *replaces* the request's body/query/params with the parsed
 * result, so controllers receive coerced, typed data and never re-parse.
 *
 * `req.query` is an accessor on Express's request prototype, so it is shadowed
 * with `Object.defineProperty` rather than assigned (assignment would throw in
 * strict mode).
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params ?? {}) as typeof req.params;
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query ?? {});
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = fieldErrors(error);
        const firstMessage = error.issues[0]?.message ?? 'Some fields need your attention.';
        return next(ApiError.validation(firstMessage, details));
      }
      next(error);
    }
  };
}

export default validate;

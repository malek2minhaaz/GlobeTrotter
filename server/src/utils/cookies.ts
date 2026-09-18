import type { CookieOptions, Response } from 'express';
import { AUTH_COOKIE, SESSION_TTL_MS } from '../config/constants';
import { isProduction } from '../config/env';

/**
 * The session token lives in an httpOnly cookie so client-side JavaScript can
 * never read it, which removes the usual XSS token-theft path.
 *
 * `sameSite: 'lax'` is enough because the SPA and the API share an origin in
 * development (via the Vite proxy) and in a same-site deployment.
 */
function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * `rememberMe` decides persistence: without it the cookie is a session cookie
 * that disappears when the browser closes.
 */
export function setAuthCookie(res: Response, token: string, rememberMe = false) {
  res.cookie(AUTH_COOKIE, token, {
    ...baseOptions(),
    ...(rememberMe ? { maxAge: SESSION_TTL_MS } : {}),
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, baseOptions());
}

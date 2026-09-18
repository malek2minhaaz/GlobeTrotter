import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AUTH_COOKIE } from '../config/constants';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { verifyToken } from '../utils/jwt';

/**
 * Accepts the session token from either the httpOnly cookie (browser flow) or an
 * `Authorization: Bearer` header (tests, scripts and any future mobile client).
 */
function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
  return cookieToken ?? null;
}

async function resolveUser(req: Request): Promise<Express.AuthUser | null> {
  const token = extractToken(req);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  // Re-read the user so a role change or account deletion takes effect
  // immediately rather than when the token happens to expire.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, deletedAt: true },
  });

  if (!user || user.deletedAt) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Rejects the request with 401 unless a valid session is present. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) throw ApiError.unauthorized();
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/** Attaches `req.user` when a session exists but never rejects. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const user = await resolveUser(req);
    if (user) req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'ADMIN') {
    return next(ApiError.forbidden('This area is restricted to administrators.'));
  }
  next();
};

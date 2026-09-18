import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './ApiError';

export interface TokenPayload {
  sub: string;
  role: 'USER' | 'ADMIN';
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/** Returns null for any invalid/expired token rather than throwing. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.sub) return null;
    return { sub: String(decoded.sub), role: (decoded as jwt.JwtPayload).role as 'USER' | 'ADMIN' };
  } catch {
    return null;
  }
}

export function assertValidToken(token: string): TokenPayload {
  const payload = verifyToken(token);
  if (!payload) throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  return payload;
}

import type { Request, Response } from 'express';
import type { z } from 'zod';
import { env, isProduction } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { clearAuthCookie, setAuthCookie } from '../utils/cookies';
import { signToken } from '../utils/jwt';
import { serializeProfile } from '../utils/serializers';
import * as authService from '../services/auth.service';
import type {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.validators';

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;
type ForgotBody = z.infer<typeof forgotPasswordSchema>;
type ResetBody = z.infer<typeof resetPasswordSchema>;
type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

function issueSession(res: Response, user: { id: string; role: 'USER' | 'ADMIN' }, rememberMe: boolean) {
  const token = signToken({ sub: user.id, role: user.role });
  setAuthCookie(res, token, rememberMe);
  return token;
}

export async function register(req: Request, res: Response) {
  const body = req.body as RegisterBody;
  const user = await authService.registerUser(body);
  // Registering signs you straight in — one less step in the demo flow.
  const token = issueSession(res, user, true);
  res.status(201).json({ data: { user: serializeProfile(user), token } });
}

export async function login(req: Request, res: Response) {
  const body = req.body as LoginBody;
  const user = await authService.authenticateUser(body);
  const token = issueSession(res, user, body.rememberMe ?? false);
  res.json({ data: { user: serializeProfile(user), token } });
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.json({ data: { success: true } });
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await authService.findUserById(req.user.id);
  if (!user) throw ApiError.unauthorized();
  res.json({ data: { user: serializeProfile(user) } });
}

/**
 * Responds identically whether or not the address exists, so this endpoint cannot
 * be used to discover who has an account.
 *
 * Email delivery is not configured for local development, so outside production
 * the reset token is returned (and logged) instead of emailed. In production it
 * is never included in the response.
 */
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as ForgotBody;
  const result = await authService.requestPasswordReset(email);

  res.json({
    data: {
      delivered: result.delivered,
      message:
        'If an account exists for that address, we have sent password reset instructions.',
      // Non-production escape hatch for exercising the reset flow without email.
      ...(!isProduction && result.rawToken
        ? {
            developmentResetToken: result.rawToken,
            developmentResetUrl: `${env.CLIENT_URL}/reset-password?token=${result.rawToken}`,
            expiresAt: result.expiresAt?.toISOString() ?? null,
          }
        : {}),
    },
  });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body as ResetBody);
  clearAuthCookie(res);
  res.json({ data: { success: true, message: 'Your password has been updated. Please sign in.' } });
}

export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await authService.changePassword(req.user.id, req.body as ChangePasswordBody);
  res.json({ data: { success: true } });
}

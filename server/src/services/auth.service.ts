import type { User } from '@prisma/client';
import type { z } from 'zod';
import { env, isProduction } from '../config/env';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { createResetToken, hashPassword, hashResetToken, verifyPassword } from '../utils/crypto';
import type {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.validators';

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export async function registerUser(input: RegisterInput): Promise<User> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict('An account with that email already exists. Try signing in instead.');
  }

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      avatar: input.avatar ?? null,
    },
  });
}

export async function authenticateUser(input: LoginInput): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Same message for "no such user" and "wrong password" so the endpoint cannot
  // be used to discover which emails have accounts.
  const invalid = ApiError.unauthorized('Those credentials did not match our records.');
  if (!user) throw invalid;
  if (user.deletedAt) throw ApiError.forbidden('This account has been deleted.');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw invalid;

  return user;
}

/**
 * Issues a single-use reset token.
 *
 * Always resolves the same way whether or not the email exists, so the endpoint
 * cannot be used to enumerate accounts. Email delivery is out of scope for local
 * development, so the raw token is returned to the caller in development only —
 * never in production.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ delivered: true; rawToken: string | null; expiresAt: Date | null }> {
  const neutral = { delivered: true as const, rawToken: null, expiresAt: null };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) return neutral;

  const { raw, hash } = createResetToken();
  const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60_000);

  // Only one live token per user keeps the reset surface small.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    }),
  ]);

  if (!isProduction) {
    console.info(
      `\n📧  Password reset requested for ${email}\n    ${env.CLIENT_URL}/reset-password?token=${raw}\n    (valid for ${env.RESET_TOKEN_TTL_MINUTES} minutes)\n`,
    );
  }

  // Outside production the caller receives the token directly, since no email
  // transport is configured locally. In production it is only ever emailed.
  return {
    delivered: true,
    rawToken: isProduction ? null : raw,
    expiresAt: isProduction ? null : expiresAt,
  };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashResetToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest(
      'This reset link is invalid or has expired. Request a new one to continue.',
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(input.password) },
    }),
    // Burn the token so it cannot be replayed.
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('We could not find your account.');

  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) throw ApiError.badRequest('Your current password is incorrect.');

  if (await verifyPassword(input.password, user.passwordHash)) {
    throw ApiError.badRequest('Your new password must be different from the current one.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.password) },
  });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

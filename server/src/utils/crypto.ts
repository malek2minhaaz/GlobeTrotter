import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Password-reset tokens are handed to the user as a raw random string but only
 * their SHA-256 digest is persisted. A leaked database therefore cannot be used
 * to reset anyone's password.
 */
export function createResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Short random suffix that keeps public share links unguessable.
 *
 * Lowercase-only, because slugs are lowercased by convention and a mixed-case
 * suffix would fail the slug pattern the API itself validates against.
 * `randomInt` is used rather than a modulo of random bytes so every character is
 * equally likely — this suffix is the only secret protecting a shared link.
 */
export function shortId(length = 5): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += alphabet[crypto.randomInt(alphabet.length)];
  }
  return output;
}

import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      name: string;
      email: string;
      role: Role;
    }

    interface Request {
      /** Populated by requireAuth / optionalAuth. */
      user?: AuthUser;
    }
  }
}

export {};

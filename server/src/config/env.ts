import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load the repo-root .env regardless of whether we are running from src/ via tsx
// or from dist/ via node.
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SERVER_URL: z.string().url().default('http://localhost:4000'),

  STORAGE_PROVIDER: z.enum(['none', 'cloudinary', 's3']).default('none'),
  STORAGE_API_KEY: z.string().optional(),
  STORAGE_API_SECRET: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_FOLDER: z.string().default('globetrotter'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Fail loudly at boot rather than mysteriously at request time.
  console.error(`\n❌  Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.\n`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

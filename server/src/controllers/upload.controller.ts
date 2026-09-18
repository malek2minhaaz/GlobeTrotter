import type { Request, Response } from 'express';
import { env } from '../config/env';
import { MAX_DATA_URL_LENGTH, type ImageUploadInput } from '../validators/media.validators';

/**
 * Image handling.
 *
 * The app must run with no storage provider configured, so there are two
 * supported paths and neither requires credentials:
 *
 *   1. An external URL is stored verbatim.
 *   2. An inline data URL is stored verbatim in the column.
 *
 * When `STORAGE_PROVIDER` is set to a real provider, `resolveProvider` reports it
 * so the client can be pointed at a direct-upload flow; the fallback paths stay
 * available regardless.
 */
function resolveProvider(): { provider: string; configured: boolean } {
  const provider = env.STORAGE_PROVIDER;
  if (provider === 'none') return { provider: 'inline', configured: true };
  const configured = Boolean(env.STORAGE_API_KEY && env.STORAGE_API_SECRET);
  return { provider, configured };
}

export async function getStorageConfig(_req: Request, res: Response) {
  const { provider, configured } = resolveProvider();
  res.json({
    data: {
      provider,
      configured,
      maxBytes: Math.floor(MAX_DATA_URL_LENGTH * 0.75),
      acceptsUrls: true,
      acceptsInlineUploads: true,
    },
  });
}

export async function createUpload(req: Request, res: Response) {
  const body = req.body as ImageUploadInput;
  const { provider } = resolveProvider();

  res.status(201).json({
    data: {
      url: body.url ?? body.dataUrl,
      source: body.url ? 'external' : 'inline',
      provider: body.url ? 'external' : provider,
    },
  });
}

import { z } from 'zod';

/** Roughly 1.5 MB of base64 payload, which is ~1.1 MB of image bytes. */
export const MAX_DATA_URL_LENGTH = 2_000_000;

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Images may arrive either as a pasted URL or as an inline data URL produced by
 * the browser's FileReader. Inline uploads mean the app is fully functional with
 * no storage provider configured (Section 2, "File Storage").
 */
export const imageUploadSchema = z
  .object({
    url: z.string().trim().url('Enter a valid image URL.').max(600).optional(),
    dataUrl: z
      .string()
      .trim()
      .max(MAX_DATA_URL_LENGTH, 'That image is too large. Please choose one under about 1 MB.')
      .regex(DATA_URL_RE, 'Only PNG, JPEG, WebP, GIF or AVIF images are supported.')
      .optional(),
  })
  .refine((data) => Boolean(data.url) !== Boolean(data.dataUrl), {
    message: 'Provide either an image URL or an uploaded file.',
  });

export type ImageUploadInput = z.infer<typeof imageUploadSchema>;

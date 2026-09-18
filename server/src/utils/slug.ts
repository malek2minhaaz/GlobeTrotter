import { shortId } from './crypto';

/** `"Goa & Mumbai Escape"` → `"goa-mumbai-escape"`. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Builds a shareable slug such as `goa-mumbai-escape-8x4k2`. The random suffix
 * makes public itineraries unguessable while staying readable in the URL.
 */
export function buildPublicSlug(tripName: string): string {
  const base = slugify(tripName) || 'trip';
  return `${base}-${shortId(5)}`;
}

import { useEffect } from 'react';

/**
 * Per-route document metadata (Section 46).
 *
 * A SPA has one HTML shell, so titles and social tags are updated as routes
 * mount. This keeps public itinerary pages shareable with a meaningful preview.
 */

const DEFAULT_TITLE = 'GlobeTrotter — Plan Your Journey. Experience More.';
const DEFAULT_DESCRIPTION =
  'GlobeTrotter is a personalised multi-city travel planner. Build day-by-day itineraries, discover activities, track your budget, and share your journey.';

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function RouteMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  image,
  type = 'website',
}: {
  title?: string;
  description?: string;
  image?: string | null;
  type?: 'website' | 'article';
}) {
  useEffect(() => {
    document.title = title ? `${title} · GlobeTrotter` : DEFAULT_TITLE;

    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', document.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', type);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', document.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    // Only advertise a preview image when one actually exists.
    const existingImage = document.head.querySelector('meta[property="og:image"]');
    if (image) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    } else if (existingImage) {
      existingImage.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
    }

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, image, type]);

  return null;
}

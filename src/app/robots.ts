import type { MetadataRoute } from 'next';

/** Private dashboard: ask crawlers to stay out. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}

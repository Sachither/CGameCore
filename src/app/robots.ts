import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/dashboard/', // We don't want search engines indexing protected player dashboards
        '/api/',
      ],
    },
    sitemap: 'https://www.cgamecore.online/sitemap.xml',
  };
}

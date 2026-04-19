import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.cgamecore.online';

  // Core Public Routes that should be indexed by search engines
  const routes = [
    '',
    '/rules',
    '/faq',
    '/terms',
    '/privacy',
    '/contact',
    '/login',
    '/register',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));
}

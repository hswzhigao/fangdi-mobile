/**
 * Cache API helpers — bounded TTL, no-cache for errors/CAPTCHA/details.
 *
 * Cache failures are silent; a cache miss or error never blocks a response.
 * Cache keys are derived from fixed route names only — never from user input URLs.
 *
 * TTL policy (matching docs/fangdi-mobile/data-policy.md):
 *   - /api/home:              60 seconds
 *   - /api/notices:            5 minutes
 *   - /api/trade:              5 minutes
 *   - /api/lease:              1 hour
 *   - errors/CAPTCHA/details:  never cached
 */

/** TTL in seconds for each cacheable route. */
export const CACHE_TTL: Record<string, number> = {
  '/api/home': 60,
  '/api/notices': 300, // 5 min
  '/api/trade': 300,   // 5 min
  '/api/lease': 3600,  // 1 hour
};

/**
 * Routes that must NEVER be cached.
 */
const NO_CACHE_ROUTES = new Set([
  '/api/captcha',
  '/api/captcha/refresh',
  '/api/new-house/search',
  '/api/old-house/search',
]);

/**
 * Build a safe cache key from a route pathname and optional validated params.
 * Never includes full URL, query string from user input, or headers.
 */
export function buildCacheKey(route: string, extra?: string): string {
  const base = `fangdi:${route}`;
  return extra ? `${base}:${extra}` : base;
}

/**
 * Determine if a route + response is eligible for caching.
 * Returns TTL seconds or 0 (do not cache).
 */
export function getCacheTTL(route: string, response: Response): number {
  // Never cache errors (non-2xx status).
  if (response.status < 200 || response.status >= 300) return 0;

  // Never cache captcha, search, or detail routes.
  if (NO_CACHE_ROUTES.has(route)) return 0;

  // Check if route starts with detail paths.
  if (route.startsWith('/api/new-house/') && route !== '/api/new-house/search') return 0;
  if (route.startsWith('/api/old-house/') && route !== '/api/old-house/search') return 0;

  return CACHE_TTL[route] ?? 0;
}

/**
 * Try to retrieve a cached Response for a cache key.
 * Returns null on cache miss or if Cache API is unavailable.
 */
export async function getCached(cacheKey: string): Promise<Response | null> {
  try {
    // caches.default is a Cloudflare Workers global; unavailable in Node/vitest.
    const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
    if (!cache) return null;

    const cached = await cache.match(cacheKey);
    return cached ?? null;
  } catch {
    // Cache failures must not block the request.
    return null;
  }
}

/**
 * Store a Response in the cache with the given TTL.
 * Cache put failures are silently ignored.
 */
export async function putCached(
  cacheKey: string,
  response: Response,
  ttlSeconds: number,
): Promise<void> {
  try {
    const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
    if (!cache) return;

    // Clone the response before caching to avoid consuming the body.
    const cloned = response.clone();

    // Create a new Response with Cache-Control header for the Cache API.
    const cacheResponse = new Response(cloned.body, {
      status: cloned.status,
      statusText: cloned.statusText,
      headers: cloned.headers,
    });
    cacheResponse.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);

    await cache.put(cacheKey, cacheResponse);
  } catch {
    // Cache put failure is non-fatal.
  }
}

/**
 * Apply cache logic for a route handler.
 *
 * 1. Check cache for a hit → return cached response.
 * 2. On miss, call the fetcher function.
 * 3. On success, cache the result (if eligible).
 *
 * Returns the response (cached or fresh).
 */
export async function withCache(
  route: string,
  cacheKey: string,
  fetcher: () => Promise<Response>,
): Promise<Response> {
  // Try cache read first.
  const cached = await getCached(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh.
  const response = await fetcher();

  // Only cache successful responses.
  const ttl = getCacheTTL(route, response);
  if (ttl > 0) {
    // Fire-and-forget cache write; don't block the response.
    putCached(cacheKey, response.clone(), ttl).catch(() => {});
  }

  return response;
}

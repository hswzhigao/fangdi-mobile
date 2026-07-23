/**
 * Safe CORS handling.
 * Origins are explicitly allowlisted; arbitrary Origin is never echoed.
 * No credentials are enabled.
 */

/** Origins permitted for cross-origin requests. */
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  // Add deployment origins here or via environment config.
]);

/** HTTP methods allowed via CORS. */
const ALLOWED_METHODS = 'GET, POST, OPTIONS';

/** Headers allowed in CORS requests. */
const ALLOWED_HEADERS = 'Content-Type, Accept';

/** Max age for CORS preflight cache (seconds). */
const MAX_AGE = '86400';

/**
 * Determine the Access-Control-Allow-Origin value for a request.
 * Returns the matched origin or null (no header set) for disallowed origins.
 */
export function corsOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }
  // No header for disallowed origins — browsers will block.
  // For same-origin requests (Origin header absent), no header needed.
  return null;
}

/**
 * Build CORS response headers for an origin.
 */
function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  // Never set Access-Control-Allow-Credentials.
  return headers;
}

/**
 * Handle an OPTIONS preflight request.
 * Returns 204 with appropriate CORS headers.
 */
export function handleOptions(request: Request): Response {
  const origin = corsOrigin(request);
  const headers = corsHeaders(origin);
  if (origin) {
    headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    headers.set('Access-Control-Max-Age', MAX_AGE);
  }
  return new Response(null, { status: 204, headers });
}

/**
 * Apply CORS headers to a non-OPTIONS response.
 * Returns a new Headers object with CORS headers merged.
 */
export function withCors(baseHeaders: Headers, request: Request): Headers {
  const origin = corsOrigin(request);
  if (origin) {
    baseHeaders.set('Access-Control-Allow-Origin', origin);
    baseHeaders.set('Vary', 'Origin');
  }
  return baseHeaders;
}

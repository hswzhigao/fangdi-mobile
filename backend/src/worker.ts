/**
 * Worker entry point — strict method+pathname routing, safe responses.
 *
 * No generic proxy. No upstream URL from user input.
 * Unimplemented routes return NOT_FOUND (not fake data).
 */

import { jsonOk, jsonError } from './http/envelope';
import { handleOptions } from './http/cors';
import { validateId } from './http/validation';
import type { CaptchaPurpose } from './captcha/types';
import { D1CaptchaStore } from './captcha/session-store';
import { CaptchaService } from './captcha/service';
import { RateLimiter } from './captcha/rate-limiter';

// ── Public content adapters ──────────────────────────────────────────────────

import { getHome } from './upstream/home';
import { getNotices } from './upstream/notices';
import { getTrade } from './upstream/trade';
import { getLease } from './upstream/lease';

export interface Env {
  DB?: D1Database;
  CAPTCHA_SALT?: string;
}

// ── Captcha service ──────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter();

function getCaptchaService(env: Env): CaptchaService | null {
  if (!env.DB || !env.CAPTCHA_SALT) return null;
  const store = new D1CaptchaStore(env.DB, env.CAPTCHA_SALT);
  return new CaptchaService(store);
}

// ── Route table ─────────────────────────────────────────────────────────────

type RouteHandler = (request: Request, env: Env, url: URL) => Response | Promise<Response>;

/** Exact method+path routes. */
const exactRoutes = new Map<string, Map<string, RouteHandler>>();

function route(method: string, pathname: string, handler: RouteHandler): void {
  let methodMap = exactRoutes.get(method);
  if (!methodMap) {
    methodMap = new Map();
    exactRoutes.set(method, methodMap);
  }
  methodMap.set(pathname, handler);
}

// ── Rate limiter helper ───────────────────────────────────────────────────────

function checkRateLimit(request: Request): Response | null {
  const retryAfter = rateLimiter.check(request);
  if (retryAfter !== null) {
    const resp = jsonError('RATE_LIMITED', undefined, undefined, request);
    resp.headers.set('Retry-After', String(retryAfter));
    return resp;
  }
  return null;
}

// ── Handlers ────────────────────────────────────────────────────────────────

function handleHealth(req: Request, _env: Env, _url: URL): Response {
  return jsonOk({ service: 'fangdi-mobile-api', status: 'ok' }, undefined, req);
}

/**
 * GET /api/captcha?purpose=new-house|old-house
 *
 * Creates a short-lived CAPTCHA session. Requires a valid `purpose` query
 * parameter (exact allowlist). Rate limited.
 *
 * Currently returns UPSTREAM_BLOCKED with purpose-specific fallback URL
 * because the upstream CAPTCHA adapter is not yet implemented.
 */
async function handleCaptcha(req: Request, env: Env, url: URL): Promise<Response> {
  // Rate limit check
  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;

  const service = getCaptchaService(env);
  if (!service) {
    return jsonError('INTERNAL_ERROR', undefined, undefined, req);
  }

  // Validate purpose query param
  const rawPurpose = url.searchParams.get('purpose');
  const purposeResult = service.validatePurpose(rawPurpose);
  if (!purposeResult.ok) {
    return jsonError('BAD_REQUEST', purposeResult.error, undefined, req);
  }

  const result = await service.createSession(purposeResult.value);
  if (result.ok) {
    return jsonOk(result.data, undefined, req);
  }

  // Map service errors to HTTP
  return mapServiceError(result.error, req);
}

/**
 * POST /api/captcha/refresh
 *
 * Refreshes an existing CAPTCHA session. Validates the sessionId,
 * binds purpose if provided, deletes the old record, and creates a new session.
 * Rate limited.
 */
async function handleCaptchaRefresh(req: Request, env: Env, _url: URL): Promise<Response> {
  // Rate limit check
  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;

  const service = getCaptchaService(env);
  if (!service) {
    return jsonError('INTERNAL_ERROR', undefined, undefined, req);
  }

  // Parse sessionId + optional purpose from JSON body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('BAD_REQUEST', '请求体格式不正确', undefined, req);
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const idErr = validateId(sessionId);
  if (idErr) {
    return jsonError('BAD_REQUEST', idErr, undefined, req);
  }

  // Optional purpose binding in refresh
  let expectedPurpose: CaptchaPurpose | undefined;
  if (typeof body.purpose === 'string' && body.purpose.trim()) {
    const pResult = service.validatePurpose(body.purpose as string);
    if (!pResult.ok) {
      return jsonError('BAD_REQUEST', pResult.error, undefined, req);
    }
    expectedPurpose = pResult.value;
  }

  const result = await service.refreshSession(sessionId, expectedPurpose);
  if (result.ok) {
    return jsonOk(result.data, undefined, req);
  }

  return mapServiceError(result.error, req);
}

// ── Service error → HTTP mapping ──────────────────────────────────────────────

function mapServiceError(
  error: import('./captcha/service').CaptchaServiceError,
  req: Request,
): Response {
  switch (error.code) {
    case 'BAD_REQUEST':
      return jsonError('BAD_REQUEST', error.message, undefined, req);
    case 'RATE_LIMITED': {
      const resp = jsonError('RATE_LIMITED', undefined, undefined, req);
      resp.headers.set('Retry-After', String(error.retryAfter));
      return resp;
    }
    case 'CAPTCHA_EXPIRED':
      return jsonError('CAPTCHA_EXPIRED', error.message, undefined, req);
    case 'CAPTCHA_INVALID':
      return jsonError('CAPTCHA_INVALID', error.message, undefined, req);
    case 'UPSTREAM_BLOCKED':
      return jsonError('UPSTREAM_BLOCKED', error.message, error.fallbackUrl, req);
    case 'INTERNAL_ERROR':
      return jsonError('INTERNAL_ERROR', undefined, undefined, req);
  }
}

// ── Register routes ─────────────────────────────────────────────────────────

route('GET', '/api/health', handleHealth);
route('GET', '/api/home', (req, _env, _url) => getHome(req));
route('GET', '/api/notices', (req, _env, url) => getNotices(url, req));
route('GET', '/api/trade', (req, _env, _url) => getTrade(req));
route('GET', '/api/lease', (req, _env, _url) => getLease(req));
route('GET', '/api/captcha', handleCaptcha);
route('POST', '/api/captcha/refresh', handleCaptchaRefresh);

// Routes reserved for later tasks — not yet implemented.
// Returning NOT_FOUND (not fake data) until adapters are built.
const RESERVED_POST_ROUTES = [
  '/api/new-house/search',
  '/api/old-house/search',
];
const PARAMETERIZED_GET_PREFIXES = [
  '/api/new-house/',
  '/api/old-house/',
];

function matchesParameterizedGet(pathname: string): boolean {
  for (const prefix of PARAMETERIZED_GET_PREFIXES) {
    if (pathname.startsWith(prefix) && pathname.length > prefix.length) {
      return true;
    }
  }
  return false;
}

// ── Fetch ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;

    // OPTIONS preflight — CORS
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    try {
      // Exact route match
      const methodMap = exactRoutes.get(method);
      if (methodMap) {
        const handler = methodMap.get(pathname);
        if (handler) {
          return await handler(request, env, new URL(request.url));
        }
      }

      // Check reserved POST routes — return NOT_FOUND (not fake data)
      if (method === 'POST') {
        if (RESERVED_POST_ROUTES.includes(pathname)) {
          return jsonError('NOT_FOUND', undefined, undefined, request);
        }
      }

      // Check parameterized GET routes (details)
      if (method === 'GET') {
        if (pathname === '/api/old-house/market-summary') {
          return jsonError('NOT_FOUND', undefined, undefined, request);
        }
        if (matchesParameterizedGet(pathname)) {
          return jsonError('NOT_FOUND', undefined, undefined, request);
        }
      }

      // Unknown route
      return jsonError('NOT_FOUND', undefined, undefined, request);
    } catch {
      // Map all unhandled exceptions to INTERNAL_ERROR.
      // Do not log request URL, body, or exception details.
      return jsonError('INTERNAL_ERROR', undefined, undefined, request);
    }
  },
};

/**
 * Worker entry point — strict method+pathname routing, safe responses.
 *
 * No generic proxy. No upstream URL from user input.
 * Unimplemented routes return NOT_FOUND (not fake data).
 */

import { jsonOk, jsonError } from './http/envelope';
import { handleOptions } from './http/cors';

export interface Env {
  DB?: unknown;
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

// ── Handlers ────────────────────────────────────────────────────────────────

function handleHealth(req: Request, _env: Env, _url: URL): Response {
  return jsonOk({ service: 'fangdi-mobile-api', status: 'ok' }, undefined, req);
}

// ── Register routes ─────────────────────────────────────────────────────────

route('GET', '/api/health', handleHealth);

// Routes reserved for later tasks — not yet implemented.
// Returning NOT_FOUND (not fake data) until adapters are built.
const RESERVED_GET_ROUTES = [
  '/api/home',
  '/api/notices',
  '/api/trade',
  '/api/lease',
  '/api/captcha',
];
const RESERVED_POST_ROUTES = [
  '/api/new-house/search',
  '/api/old-house/search',
  '/api/captcha/refresh',
];
const PARAMETERIZED_GET_PREFIXES = [
  '/api/new-house/',
  '/api/old-house/',
];

/**
 * Check if a path matches a parameterized route prefix
 * (e.g., /api/new-house/:id, /api/old-house/:id).
 */
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

      // Check reserved routes — return NOT_FOUND (not fake data)
      if (method === 'GET') {
        if (RESERVED_GET_ROUTES.includes(pathname)) {
          return jsonError('NOT_FOUND', undefined, undefined, request);
        }
        // Also check /api/old-house/market-summary
        if (pathname === '/api/old-house/market-summary') {
          return jsonError('NOT_FOUND', undefined, undefined, request);
        }
        // Parameterized GET routes
        if (matchesParameterizedGet(pathname)) {
          return jsonError('NOT_FOUND', undefined, undefined, request);
        }
      }

      if (method === 'POST') {
        if (RESERVED_POST_ROUTES.includes(pathname)) {
          return jsonError('NOT_FOUND', undefined, undefined, request);
        }
      }

      // Unknown route
      return jsonError('NOT_FOUND', undefined, undefined, request);
    } catch (e) {
      // Map all unhandled exceptions to INTERNAL_ERROR.
      // Do not log request URL, body, or exception details.
      return jsonError('INTERNAL_ERROR', undefined, undefined, request);
    }
  },
};

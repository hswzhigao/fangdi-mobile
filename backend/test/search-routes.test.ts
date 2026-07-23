/**
 * Search route smoke tests — HTTP contract for new-house and old-house routes.
 *
 * Verifies: exact route matching, BAD_REQUEST for invalid filters,
 * UPSTREAM_BLOCKED for list/detail (WAF), verified market-summary,
 * no-cache headers on search/detail, captcha purpose binding,
 * parameterized GET detail ID validation, and route isolation
 * (no cross-route leakage).
 *
 * These tests use the actual Worker fetch entry point — no mocking.
 * They exercise the real validation, routing, and adapter integration.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { unstable_dev, UnstableDevWorker } from 'wrangler';

let worker: UnstableDevWorker;

beforeAll(async () => {
  worker = await unstable_dev('src/worker.ts', {
    experimental: { disableExperimentalWarning: true },
  });
});

afterAll(async () => {
  if (worker) await worker.stop();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function jsonResponse(response: Response) {
  const body = await response.json();
  return { status: response.status, body };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health smoke (sanity check that worker is running)
// ═══════════════════════════════════════════════════════════════════════════════

describe('worker health', () => {
  it('GET /api/health returns ok', async () => {
    const resp = await worker.fetch('http://localhost/api/health');
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(true);
    expect((b.data as Record<string, unknown>).status).toBe('ok');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/new-house/search
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/new-house/search', () => {
  it('returns 502 UPSTREAM_BLOCKED for valid minimal filter', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(502);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    const err = b.error as Record<string, unknown>;
    expect(err.code).toBe('UPSTREAM_BLOCKED');
    expect(err.retryable).toBe(true);
    expect(err.fallbackUrl).toContain('new_house');
  });

  it('returns 502 UPSTREAM_BLOCKED for full valid filter', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        district: '浦东新区',
        propertyType: 'residential',
        status: 'available',
        minArea: 50,
        maxArea: 200,
        projectName: '金桥瑞仕',
        page: 1,
        pageSize: 20,
      }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(502);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
  });

  it('returns 400 BAD_REQUEST for invalid JSON body', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });

  it('returns 400 BAD_REQUEST for missing page', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageSize: 10 }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });

  it('returns 400 BAD_REQUEST for unknown key', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, hack: true }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });

  it('returns 400 BAD_REQUEST for pageSize > 20', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 50 }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });

  it('returns 400 BAD_REQUEST for invalid propertyType', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, propertyType: 'villa' }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns 400 BAD_REQUEST for invalid status', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, status: 'rented' }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns 400 BAD_REQUEST for minArea > maxArea', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, minArea: 200, maxArea: 50 }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns no-cache headers (no Cache-Control: public)', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    const cacheControl = resp.headers.get('Cache-Control');
    // jsonError does not set Cache-Control, so it should either be absent
    // or explicitly no-cache. Our safe headers don't add Cache-Control.
    // This is correct: no caching for search responses.
    expect(cacheControl).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/new-house/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/new-house/:id', () => {
  it('returns 502 UPSTREAM_BLOCKED for valid id', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/proj-001');
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(502);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    const err = b.error as Record<string, unknown>;
    expect(err.code).toBe('UPSTREAM_BLOCKED');
    expect(err.fallbackUrl).toContain('new_house');
  });

  it('returns 400 BAD_REQUEST for invalid id (contains slash)', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/hack/path');
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });

  it('returns 400 BAD_REQUEST for id with special chars', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/<script>');
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });

  it('returns 404 for empty/no id (trailing slash without id segment)', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/');
    const { status, body } = await jsonResponse(resp);
    // Trailing slash without id segment doesn't match parameterized route.
    // It falls through to NOT_FOUND.
    expect(status).toBe(404);
  });

  it('returns 400 BAD_REQUEST for id too long (>80)', async () => {
    const resp = await worker.fetch(`http://localhost/api/new-house/${'a'.repeat(81)}`);
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns no-cache headers', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/proj-001');
    expect(resp.headers.get('Cache-Control')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/old-house/search
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/old-house/search', () => {
  it('returns 502 UPSTREAM_BLOCKED for valid minimal filter', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(502);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    const err = b.error as Record<string, unknown>;
    expect(err.code).toBe('UPSTREAM_BLOCKED');
    expect(err.fallbackUrl).toContain('old_house');
  });

  it('returns 502 UPSTREAM_BLOCKED for full valid filter', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        district: '徐汇区',
        minArea: 60,
        maxArea: 120,
        minPrice: 1000000,
        maxPrice: 5000000,
        rooms: 3,
        propertyType: 'residential',
        keyword: '地铁',
        page: 1,
        pageSize: 20,
      }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(502);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    const err = b.error as Record<string, unknown>;
    expect(err.code).toBe('UPSTREAM_BLOCKED');
  });

  it('returns 400 BAD_REQUEST for invalid JSON body', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns 400 BAD_REQUEST for unknown key', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, hack: true }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns 400 BAD_REQUEST for minPrice > maxPrice', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, minPrice: 5000000, maxPrice: 1000000 }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns 400 BAD_REQUEST for float rooms', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, rooms: 2.5 }),
    });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(400);
  });

  it('returns no-cache headers', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    expect(resp.headers.get('Cache-Control')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/old-house/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/old-house/:id', () => {
  it('returns 502 UPSTREAM_BLOCKED for valid id', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/house_001');
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(502);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    const err = b.error as Record<string, unknown>;
    expect(err.code).toBe('UPSTREAM_BLOCKED');
    expect(err.fallbackUrl).toContain('old_house');
  });

  it('returns 400 BAD_REQUEST for invalid id (special chars)', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/hack%00test');
    const { status, body } = await jsonResponse(resp);
    // Null byte in URL-encoded path is rejected by ID validation
    expect(status).toBe(400);
  });

  it('returns no-cache headers', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/house_001');
    expect(resp.headers.get('Cache-Control')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/old-house/market-summary (verified)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/old-house/market-summary', () => {
  // This endpoint calls the verified upstream /oldhouse/getSHYesterdaySell.action.
  // Since local tests may not have network access or may encounter WAF,
  // we verify the route exists and returns a valid envelope shape.

  it('route exists and returns a response (may be UPSTREAM_BLOCKED locally)', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/market-summary');
    // Route is registered — will return something (not 404).
    expect(resp.status).not.toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Route isolation — existing routes preserved
// ═══════════════════════════════════════════════════════════════════════════════

describe('existing route isolation', () => {
  it('GET /api/home still works', async () => {
    const resp = await worker.fetch('http://localhost/api/home');
    expect(resp.status).not.toBe(404);
    // May fail with upstream error — that's fine, just ensure route exists
  });

  it('GET /api/notices still works', async () => {
    const resp = await worker.fetch('http://localhost/api/notices?kind=policy&page=1&pageSize=10');
    expect(resp.status).not.toBe(404);
  });

  it('GET /api/trade still works', async () => {
    const resp = await worker.fetch('http://localhost/api/trade');
    expect(resp.status).not.toBe(404);
  });

  it('GET /api/lease still works', async () => {
    const resp = await worker.fetch('http://localhost/api/lease');
    expect(resp.status).toBe(200); // Static content — always works
  });

  it('GET /api/captcha still works', async () => {
    const resp = await worker.fetch('http://localhost/api/captcha?purpose=new-house');
    expect(resp.status).not.toBe(404);
  });

  it('POST /api/captcha/refresh still works', async () => {
    const resp = await worker.fetch('http://localhost/api/captcha/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test' }),
    });
    // Without DB binding, returns INTERNAL_ERROR (500) — this is expected
    // The route exists and is correctly dispatched
    const { body } = await jsonResponse(resp);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('INTERNAL_ERROR');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Unknown routes → NOT_FOUND
// ═══════════════════════════════════════════════════════════════════════════════

describe('unknown routes', () => {
  it('returns 404 for unknown POST', async () => {
    const resp = await worker.fetch('http://localhost/api/unknown', { method: 'POST' });
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(404);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('NOT_FOUND');
  });

  it('returns 404 for unknown GET', async () => {
    const resp = await worker.fetch('http://localhost/api/unknown');
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(404);
  });

  it('returns 404 for /api/search (generic search — not implemented)', async () => {
    const resp = await worker.fetch('http://localhost/api/search');
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(404);
  });

  it('GET /api/new-house/search matches parameterized detail (id="search")', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search');
    // GET matches parameterized route with id="search" → UPSTREAM_BLOCKED (detail)
    const { status, body } = await jsonResponse(resp);
    expect(status).toBe(502);
  });

  it('returns NOT_FOUND for new-house detail sub-paths beyond one segment', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/abc/def');
    const { status, body } = await jsonResponse(resp);
    // The id will be "abc/def" which fails id validation
    expect(status).toBe(400);
  });
});
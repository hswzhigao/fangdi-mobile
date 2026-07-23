/**
 * Cache policy tests — TTL assignment, cache eligibility, cache key derivation.
 *
 * Tests verify:
 * - Correct TTL for each route (home:60s, notices:5m, trade:5m, lease:1h)
 * - No cache for errors, captcha, details, search routes
 * - Cache key derivation from route name only (no user input)
 * - Cache API calls are safe when Cache API is unavailable (node environment)
 */

import { describe, expect, it } from 'vitest';
import {
  CACHE_TTL,
  buildCacheKey,
  getCacheTTL,
  getCached,
  putCached,
} from '../src/cache/cache';

// ═══════════════════════════════════════════════════════════════════════════
// CACHE_TTL constants
// ═══════════════════════════════════════════════════════════════════════════

describe('CACHE_TTL constants', () => {
  it('home → 60 seconds', () => {
    expect(CACHE_TTL['/api/home']).toBe(60);
  });

  it('notices → 300 seconds (5 min)', () => {
    expect(CACHE_TTL['/api/notices']).toBe(300);
  });

  it('trade → 300 seconds (5 min)', () => {
    expect(CACHE_TTL['/api/trade']).toBe(300);
  });

  it('lease → 3600 seconds (1 hour)', () => {
    expect(CACHE_TTL['/api/lease']).toBe(3600);
  });

  it('unknown routes have no TTL', () => {
    expect(CACHE_TTL['/api/unknown']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildCacheKey
// ═══════════════════════════════════════════════════════════════════════════

describe('buildCacheKey', () => {
  it('builds key from route name only', () => {
    expect(buildCacheKey('/api/home')).toBe('fangdi:/api/home');
  });

  it('builds key with extra params', () => {
    expect(buildCacheKey('/api/notices', 'proclamation:1:10')).toBe('fangdi:/api/notices:proclamation:1:10');
  });

  it('never includes arbitrary URLs', () => {
    const key = buildCacheKey('/api/notices', 'proclamation:1:10');
    expect(key).not.toContain('fangdi.com.cn');
    expect(key).not.toContain('?url=');
    expect(key).not.toContain('http');
  });

  it('extra parameter is optional', () => {
    expect(buildCacheKey('/api/trade')).toBe('fangdi:/api/trade');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getCacheTTL (cache eligibility)
// ═══════════════════════════════════════════════════════════════════════════

describe('getCacheTTL', () => {
  it('returns TTL for home on 200 response', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/home', res)).toBe(60);
  });

  it('returns TTL for notices on 200 response', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/notices', res)).toBe(300);
  });

  it('returns TTL for trade on 200 response', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/trade', res)).toBe(300);
  });

  it('returns TTL for lease on 200 response', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/lease', res)).toBe(3600);
  });

  // ── No cache for errors ────────────────────────────────────────────────

  it('returns 0 for 400 error response', () => {
    const res = new Response('{}', { status: 400 });
    expect(getCacheTTL('/api/home', res)).toBe(0);
  });

  it('returns 0 for 404 error response', () => {
    const res = new Response('{}', { status: 404 });
    expect(getCacheTTL('/api/home', res)).toBe(0);
  });

  it('returns 0 for 500 error response', () => {
    const res = new Response('{}', { status: 500 });
    expect(getCacheTTL('/api/home', res)).toBe(0);
  });

  it('returns 0 for 502 UPSTREAM_BLOCKED', () => {
    const res = new Response('{}', { status: 502 });
    expect(getCacheTTL('/api/home', res)).toBe(0);
  });

  it('returns 0 for 504 UPSTREAM_TIMEOUT', () => {
    const res = new Response('{}', { status: 504 });
    expect(getCacheTTL('/api/home', res)).toBe(0);
  });

  // ── No cache for captcha ───────────────────────────────────────────────

  it('returns 0 for captcha route', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/captcha', res)).toBe(0);
  });

  it('returns 0 for captcha refresh route', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/captcha/refresh', res)).toBe(0);
  });

  // ── No cache for search ────────────────────────────────────────────────

  it('returns 0 for new-house search', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/new-house/search', res)).toBe(0);
  });

  it('returns 0 for old-house search', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/old-house/search', res)).toBe(0);
  });

  // ── No cache for details ───────────────────────────────────────────────

  it('returns 0 for new-house detail route', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/new-house/abc123', res)).toBe(0);
  });

  it('returns 0 for old-house detail route', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/old-house/xyz-789', res)).toBe(0);
  });

  it('returns 300 (5 min) for market-summary route', () => {
    const res = new Response('{}', { status: 200 });
    expect(getCacheTTL('/api/old-house/market-summary', res)).toBe(300);
  });

  it('CACHE_TTL constant contains market-summary with 300s', () => {
    expect(CACHE_TTL['/api/old-house/market-summary']).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getCached / putCached (graceful degradation)
// ═══════════════════════════════════════════════════════════════════════════

describe('getCached (no Cache API in node)', () => {
  it('returns null when Cache API is unavailable', async () => {
    // In vitest/node environment, caches.default does not exist.
    const result = await getCached('fangdi:/api/home');
    expect(result).toBeNull();
  });

  it('returns null for any cache key', async () => {
    const result = await getCached('anything');
    expect(result).toBeNull();
  });
});

describe('putCached (no Cache API in node)', () => {
  it('does not throw when Cache API is unavailable', async () => {
    const res = new Response(JSON.stringify({ ok: true, data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    // Should not throw.
    await expect(putCached('fangdi:/api/home', res, 60)).resolves.toBeUndefined();
  });

  it('handles put for lease 1-hour TTL without throwing', async () => {
    const res = new Response(JSON.stringify({ ok: true, data: {} }));
    await expect(putCached('fangdi:/api/lease', res, 3600)).resolves.toBeUndefined();
  });
});

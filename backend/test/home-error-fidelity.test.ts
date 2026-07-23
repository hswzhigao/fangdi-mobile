/**
 * Home error fidelity tests — verifies that when ALL modules fail, the correct
 * prioritized error code is returned instead of always UPSTREAM_BLOCKED.
 *
 * Scenarios:
 *   - All modules UPSTREAM_BLOCKED  → returns UPSTREAM_BLOCKED
 *   - All modules UPSTREAM_TIMEOUT  → returns UPSTREAM_TIMEOUT
 *   - All modules UPSTREAM_SCHEMA   → returns UPSTREAM_SCHEMA
 *   - Mixed errors (blocked + timeout) → blocked wins (higher priority)
 *   - Partial success → returns data (no fabricated failure)
 *   - All-empty with no trackable errors → error, not fake success
 */

import { describe, expect, it, vi } from 'vitest';

// ── Mock setup (hoisted by vitest) ──────────────────────────────────────────

const mockFetchUpstreamJson = vi.fn();
let mockResults: unknown[] = [];

function setResults(results: unknown[]) {
  mockResults = results;
  mockFetchUpstreamJson.mockReset();
  let idx = 0;
  mockFetchUpstreamJson.mockImplementation(() => {
    const result = mockResults[idx % mockResults.length];
    idx++;
    return Promise.resolve(result);
  });
}

vi.mock('../src/upstream/fetch', () => ({
  UPSTREAM_BASE: 'https://www.fangdi.com.cn',
  FALLBACK_URLS: {
    '/api/home': 'https://www.fangdi.com.cn/',
    '/api/notices': 'https://www.fangdi.com.cn/',
    '/api/trade': 'https://www.fangdi.com.cn/trade/trade.html',
    '/api/lease': 'https://www.fangdi.com.cn/lease/lease.html',
  },
  fetchUpstreamJson: mockFetchUpstreamJson,
  toErrorResponse: (_err: unknown, _req?: unknown) => {
    const e = _err as { code: string; message: string; retryable: boolean; fallbackUrl?: string };
    return new Response(JSON.stringify({
      ok: false,
      error: {
        code: e.code,
        message: e.message,
        retryable: e.retryable,
        ...(e.fallbackUrl ? { fallbackUrl: e.fallbackUrl } : {}),
      },
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  },
  toSuccessResponse: (data: unknown, _cached: boolean, _req?: unknown) => {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
  isUpstreamError: (value: unknown) => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'code' in value &&
      (value as Record<string, unknown>).code !== undefined
    );
  },
}));

vi.mock('../src/cache/cache', () => ({
  CACHE_TTL: { '/api/home': 60, '/api/notices': 300, '/api/trade': 300, '/api/lease': 3600 },
  buildCacheKey: (route: string, extra?: string) => extra ? `fangdi:${route}:${extra}` : `fangdi:${route}`,
  getCached: () => Promise.resolve(null),
  putCached: () => Promise.resolve(),
  withCache: (_route: string, _key: string, fetcher: () => Promise<Response>) => fetcher(),
  getCacheTTL: () => 0,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

async function callGetHome(): Promise<Response> {
  const { getHome } = await import('../src/upstream/home');
  return getHome(new Request('http://localhost/api/home'));
}

function makeError(code: string, message = 'test error') {
  return { code, message, retryable: code !== 'UPSTREAM_SCHEMA' };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('getHome error fidelity', () => {
  it('returns UPSTREAM_BLOCKED when all modules are blocked', async () => {
    setResults(Array(9).fill(makeError('UPSTREAM_BLOCKED', '验证')));

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; error?: { code: string; message: string } };

    expect(body.ok).toBe(false);
    expect(body.error!.code).toBe('UPSTREAM_BLOCKED');
    expect(body.error!.message).toContain('验证');
  });

  it('returns UPSTREAM_TIMEOUT when all modules timeout', async () => {
    setResults(Array(9).fill(makeError('UPSTREAM_TIMEOUT', '超时')));

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(body.ok).toBe(false);
    expect(body.error!.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('returns UPSTREAM_BAD_STATUS when all modules return bad status', async () => {
    setResults(Array(9).fill(makeError('UPSTREAM_BAD_STATUS', '暂不可用')));

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(body.ok).toBe(false);
    expect(body.error!.code).toBe('UPSTREAM_BAD_STATUS');
  });

  it('returns UPSTREAM_SCHEMA when all modules have schema errors', async () => {
    setResults(Array(9).fill(makeError('UPSTREAM_SCHEMA', '格式异常')));

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(body.ok).toBe(false);
    expect(body.error!.code).toBe('UPSTREAM_SCHEMA');
  });

  it('prioritizes UPSTREAM_BLOCKED over UPSTREAM_TIMEOUT when mixed', async () => {
    // 5 modules blocked, 4 timeout → blocked wins (higher priority)
    setResults([
      ...Array(5).fill(makeError('UPSTREAM_BLOCKED', 'blocked')),
      ...Array(4).fill(makeError('UPSTREAM_TIMEOUT', 'timeout')),
    ]);

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(body.ok).toBe(false);
    expect(body.error!.code).toBe('UPSTREAM_BLOCKED');
  });

  it('prioritizes UPSTREAM_TIMEOUT over UPSTREAM_SCHEMA when mixed', async () => {
    setResults([
      ...Array(5).fill(makeError('UPSTREAM_TIMEOUT', 'timeout')),
      ...Array(4).fill(makeError('UPSTREAM_SCHEMA', 'schema')),
    ]);

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; error?: { code: string } };

    expect(body.ok).toBe(false);
    expect(body.error!.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('returns success with partial data when some modules succeed', async () => {
    // Module 1 (notices) succeeds with valid data; rest return errors.
    setResults([
      { list: [{ id: 'notice-1', title: 'Test Notice', publishDate: '2026-01-01T00:00:00Z' }] },
      ...Array(8).fill(makeError('UPSTREAM_BLOCKED', 'blocked')),
    ]);

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; data?: { notices: unknown[] }; error?: { code: string } };

    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data!.notices.length).toBeGreaterThan(0);
  });

  it('does not fabricate success when all modules return empty data', async () => {
    // All modules return empty arrays (valid JSON but no items).
    setResults(Array(9).fill({ list: [] }));

    const response = await callGetHome();
    const body = await response.json() as { ok: boolean; data?: unknown; error?: { code: string } };

    // All-empty must be an error, not fake success.
    expect(body.ok).toBe(false);
  });
});

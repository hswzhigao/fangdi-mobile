/**
 * API client tests — envelope validation, error handling, abort, path construction.
 * Tests the real apiGet/apiPost functions with a mock fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, apiPost } from '../src/api/client';
import type { ApiError, ApiErrorCode } from '../src/api/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build an ok:true envelope response. */
function okEnvelope<T>(data: T, meta?: { source: string; cached: boolean; fetchedAt: string }): Response {
  const body: Record<string, unknown> = { ok: true, data };
  if (meta) body.meta = meta;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Build an ok:false envelope response. */
function errorEnvelope(
  code: string,
  message: string,
  retryable: boolean,
  fallbackUrl?: string,
): Response {
  const body = {
    ok: false,
    error: { code, message, retryable, ...(fallbackUrl ? { fallbackUrl } : {}) },
  };
  return new Response(JSON.stringify(body), {
    status: 502,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Build a non-JSON HTML response. */
function htmlResponse(body: string, contentType = 'text/html; charset=utf-8'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}

/** Assert that a promise rejects with an ApiError matching expected fields. */
async function expectApiError(
  promise: Promise<unknown>,
  expectedCode: ApiErrorCode,
  expectedRetryable: boolean,
): Promise<ApiError> {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (err: unknown) {
    expect(err).toBeDefined();
    const apiErr = err as ApiError;
    expect(apiErr.code).toBe(expectedCode);
    expect(apiErr.retryable).toBe(expectedRetryable);
    expect(typeof apiErr.message).toBe('string');
    return apiErr;
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('apiGet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps ok:true envelope and returns typed data + meta', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okEnvelope({ name: 'Shanghai' }))));

    const result = await apiGet<{ name: string }>('/api/trade');
    expect(result.data).toEqual({ name: 'Shanghai' });
    expect(result.meta).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns data with meta when present', async () => {
    const meta = { source: 'upstream' as const, cached: false, fetchedAt: '2024-01-01T00:00:00Z' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okEnvelope({ items: [] }, meta))));

    const result = await apiGet<{ items: unknown[] }>('/api/home');
    expect(result.data).toEqual({ items: [] });
    expect(result.meta).toEqual(meta);
  });

  it('throws ApiError with UPSTREAM_BLOCKED on ok:false envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(errorEnvelope('UPSTREAM_BLOCKED', 'blocked', true, 'https://www.fangdi.com.cn/')),
    ));

    const err = await expectApiError(apiGet('/api/home'), 'UPSTREAM_BLOCKED', true);
    expect(err.fallbackUrl).toBe('https://www.fangdi.com.cn/');
  });

  it('throws ApiError for each documented error code', async () => {
    const codes: [ApiErrorCode, boolean][] = [
      ['BAD_REQUEST', false],
      ['NOT_FOUND', false],
      ['RATE_LIMITED', true],
      ['CAPTCHA_REQUIRED', false],
      ['INTERNAL_ERROR', true],
    ];

    for (const [code, retryable] of codes) {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve(errorEnvelope(code, 'test', retryable)),
      ));
      await expectApiError(apiGet('/api/home'), code, retryable);
    }
  });

  it('throws on HTML response (WAF challenge)', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(htmlResponse('<html><body>WAF Challenge</body></html>')),
    ));

    await expectApiError(apiGet('/api/trade'), 'UPSTREAM_BLOCKED', true);
  });

  it('throws on non-JSON response without HTML content-type', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(htmlResponse('<!doctype html><html>...</html>', 'application/json')),
    ));

    await expectApiError(apiGet('/api/trade'), 'UPSTREAM_BLOCKED', true);
  });

  it('throws SCHEMA error on valid JSON without envelope shape', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ random: 'data', no_ok_field: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
    ));

    await expectApiError(apiGet('/api/trade'), 'UPSTREAM_SCHEMA', false);
  });

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    await expectApiError(apiGet('/api/trade'), 'UPSTREAM_BAD_STATUS', true);
  });

  it('throws UPSTREAM_TIMEOUT on AbortError', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      const err = new DOMException('aborted', 'AbortError');
      return Promise.reject(err);
    }));

    await expectApiError(apiGet('/api/trade'), 'UPSTREAM_TIMEOUT', true);
  });

  it('passes AbortSignal through to fetch', async () => {
    const controller = new AbortController();
    const fetchSpy = vi.fn(() => Promise.resolve(okEnvelope({ done: true })));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await apiGet<{ done: boolean }>('/api/test', controller.signal);

    expect(result.data).toEqual({ done: true });
    const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].signal).toBeDefined();
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('uses relative path in production (empty VITE_API_URL)', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.resetModules();

    const fetchSpy = vi.fn(() => Promise.resolve(okEnvelope({ ok: true })));
    vi.stubGlobal('fetch', fetchSpy);

    // Dynamic import to pick up stubbed env
    const { apiGet: freshGet } = await import('../src/api/client');
    await freshGet('/api/health');

    const url = (fetchSpy.mock.calls[0] as [string])[0];
    expect(url).toBe('/api/health');
  });

  it('throws on response with error as string instead of object', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'bad shape' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })),
    ));

    await expectApiError(apiGet('/api/trade'), 'UPSTREAM_SCHEMA', false);
  });

  it('rejects invalid meta.source values, defaults to upstream', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(okEnvelope({ items: [1] }, { source: 'unknown' as any, cached: true, fetchedAt: '2024-01-01T00:00:00Z' })),
    ));

    const result = await apiGet<{ items: number[] }>('/api/home');
    expect(result.meta).toBeDefined();
    expect(result.meta!.source).toBe('upstream'); // invalid source → upstream default
    expect(result.meta!.cached).toBe(true);
  });

  it('omits meta when meta shape is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(okEnvelope({ items: [1] }, { source: 'upstream', cached: 'not a boolean' as any, fetchedAt: '2024-01-01T00:00:00Z' })),
    ));

    const result = await apiGet<{ items: number[] }>('/api/home');
    expect(result.meta).toBeUndefined(); // invalid meta dropped
  });
});

describe('apiPost', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST with JSON body', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(okEnvelope({ success: true })));
    vi.stubGlobal('fetch', fetchSpy);

    const body = { page: 1, pageSize: 10 };
    const result = await apiPost<{ success: boolean }>('/api/new-house/search', body);

    expect(result.data).toEqual({ success: true });
    const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].body).toBe(JSON.stringify(body));
  });

  it('throws ApiError on error envelope from POST', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(errorEnvelope('BAD_REQUEST', 'invalid page', false)),
    ));

    await expectApiError(
      apiPost('/api/new-house/search', { page: -1 }),
      'BAD_REQUEST',
      false,
    );
  });

  it('throws on HTML response from POST', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(htmlResponse('<html>WAF</html>')),
    ));

    await expectApiError(
      apiPost('/api/old-house/search', { page: 1, pageSize: 10 }),
      'UPSTREAM_BLOCKED',
      true,
    );
  });

  it('throws on network error from POST', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    await expectApiError(
      apiPost('/api/new-house/search', { page: 1, pageSize: 10 }),
      'UPSTREAM_BAD_STATUS',
      true,
    );
  });
});

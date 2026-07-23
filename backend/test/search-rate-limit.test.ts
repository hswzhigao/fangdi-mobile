/**
 * Search rate-limit tests — verifies that every valid complex search request
 * is rate-limited before the optional CAPTCHA branch.
 *
 * Uses a dedicated worker instance to avoid contaminating other test files.
 * The in-memory rate limiter allows 10 req/min per key.
 * CF-Connecting-IP is absent in test → all requests share the "unknown" key.
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

async function jsonResponse(response: Response) {
  const body = await response.json();
  return { status: response.status, body };
}

describe('search rate limiting (no captcha)', () => {
  it('allows first 10 valid new-house search requests', async () => {
    for (let i = 0; i < 10; i++) {
      const resp = await worker.fetch('http://localhost/api/new-house/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 10 }),
      });
      expect(resp.status).not.toBe(429);
    }
  });

  it('returns 429 RATE_LIMITED on 11th valid new-house search request', async () => {
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    expect(resp.status).toBe(429);
    const retryAfter = resp.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    const { body } = await jsonResponse(resp);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('RATE_LIMITED');
  });

  it('invalid JSON body does NOT consume rate-limit slot', async () => {
    // We're already rate-limited from above tests, so all valid requests return 429.
    // But invalid requests should still return 400 (they skip rate limiting).
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(resp.status).toBe(400);
    const { body } = await jsonResponse(resp);
    const b = body as Record<string, unknown>;
    expect((b.error as Record<string, unknown>).code).toBe('BAD_REQUEST');
  });

  it('invalid fields (before rate limit) still return BAD_REQUEST when rate-limited', async () => {
    // Unknown key → BAD_REQUEST before rate-limit check.
    const resp = await worker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10, hack: true }),
    });
    expect(resp.status).toBe(400);
  });
});

describe('old-house search rate limiting', () => {
  // Fresh describe block but same worker — already rate-limited from above.
  // Verify that old-house valid requests also get 429.
  it('valid old-house search is rate limited (shared window exhausted)', async () => {
    const resp = await worker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).not.toBeNull();
  });
});

// ── CAPTCHA rate-limit isolation (fresh worker) ───────────────────────────────

describe('search rate limiting (with captcha) — single slot per request', () => {
  let captchaWorker: UnstableDevWorker;

  beforeAll(async () => {
    captchaWorker = await unstable_dev('src/worker.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    if (captchaWorker) await captchaWorker.stop();
  });

  it('10 CAPTCHA new-house requests consume exactly 10 slots (not 20)', async () => {
    // With the old double-check bug, only 5 CAPTCHA requests would fit in 10 slots.
    // Each CAPTCHA request must consume exactly 1 rate-limit slot.
    for (let i = 0; i < 10; i++) {
      const resp = await captchaWorker.fetch('http://localhost/api/new-house/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1, pageSize: 10,
          captchaSession: 'test-session',
          captchaText: 'ABCD',
        }),
      });
      // Without DB binding, CAPTCHA validation fails with INTERNAL_ERROR,
      // but rate limit must NOT have been hit (no 429).
      expect(resp.status).not.toBe(429);
    }
  });

  it('11th CAPTCHA new-house request returns 429 after 10 slots consumed', async () => {
    const resp = await captchaWorker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1, pageSize: 10,
        captchaSession: 'test-session',
        captchaText: 'ABCD',
      }),
    });
    expect(resp.status).toBe(429);
    const retryAfter = resp.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    const { body } = await jsonResponse(resp);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('RATE_LIMITED');
  });

  it('10 CAPTCHA old-house requests consume exactly 10 slots (not 20)', async () => {
    // Reset: use a fresh worker for old-house CAPTCHA isolation.
    if (captchaWorker) await captchaWorker.stop();
    captchaWorker = await unstable_dev('src/worker.ts', {
      experimental: { disableExperimentalWarning: true },
    });
    for (let i = 0; i < 10; i++) {
      const resp = await captchaWorker.fetch('http://localhost/api/old-house/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1, pageSize: 10,
          captchaSession: 'old-session',
          captchaText: 'WXYZ',
        }),
      });
      expect(resp.status).not.toBe(429);
    }
  });

  it('11th CAPTCHA old-house request returns 429 after 10 slots consumed', async () => {
    const resp = await captchaWorker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1, pageSize: 10,
        captchaSession: 'old-session',
        captchaText: 'WXYZ',
      }),
    });
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).not.toBeNull();
    const { body } = await jsonResponse(resp);
    const b = body as Record<string, unknown>;
    expect(b.ok).toBe(false);
    expect((b.error as Record<string, unknown>).code).toBe('RATE_LIMITED');
  });

  it('no-CAPTCHA requests also consume exactly 1 slot each', async () => {
    // Fresh worker: verify no-CAPTCHA requests also consume exactly 1 slot.
    if (captchaWorker) await captchaWorker.stop();
    captchaWorker = await unstable_dev('src/worker.ts', {
      experimental: { disableExperimentalWarning: true },
    });
    for (let i = 0; i < 10; i++) {
      const resp = await captchaWorker.fetch('http://localhost/api/new-house/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 10 }),
      });
      expect(resp.status).not.toBe(429);
    }
    // 11th returns 429
    const resp = await captchaWorker.fetch('http://localhost/api/new-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).not.toBeNull();
  });

  it('429 response includes Retry-After header', async () => {
    // Already rate-limited from previous test — just verify header shape.
    const resp = await captchaWorker.fetch('http://localhost/api/old-house/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    });
    expect(resp.status).toBe(429);
    const retryAfter = resp.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});

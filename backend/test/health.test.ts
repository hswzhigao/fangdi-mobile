import { describe, expect, it, vi, beforeEach } from 'vitest';

type WorkerModule = {
  fetch(request: Request, env: Record<string, unknown>): Promise<Response>;
};

let worker: WorkerModule;

async function loadWorker() {
  vi.resetModules();
  ({ default: worker } = await import('../src/worker'));
}

describe('health endpoint', () => {
  beforeEach(async () => {
    await loadWorker();
  });

  it('GET /api/health returns ok with service info', async () => {
    const response = await worker.fetch(
      new Request('http://local.test/api/health', { method: 'GET' }),
      {},
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      service: 'fangdi-mobile-api',
      status: 'ok',
    });
  });

  it('OPTIONS /api/health returns 204 with CORS headers', async () => {
    const response = await worker.fetch(
      new Request('http://local.test/api/health', { method: 'OPTIONS' }),
      {},
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('unknown route returns 404', async () => {
    const response = await worker.fetch(
      new Request('http://local.test/api/unknown', { method: 'GET' }),
      {},
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Not found');
  });

  it('POST /api/health returns 404', async () => {
    const response = await worker.fetch(
      new Request('http://local.test/api/health', { method: 'POST' }),
      {},
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Not found');
  });
});

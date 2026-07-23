import { describe, expect, it, vi, beforeEach } from 'vitest';

// Test the real getApiUrl from the api utility
// Uses vi.stubEnv + dynamic import so each test picks up its own env state.
describe('bootstrap - getApiUrl (real import)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns absolute URL when VITE_API_URL is configured', async () => {
    vi.stubEnv('VITE_API_URL', 'https://example.com');
    const { getApiUrl } = await import('../src/utils/api');
    expect(getApiUrl('/api/health')).toBe('https://example.com/api/health');
    expect(getApiUrl('/api/records')).toBe('https://example.com/api/records');
  });

  it('returns relative path when VITE_API_URL is empty (placeholder rejected)', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const { getApiUrl } = await import('../src/utils/api');
    expect(getApiUrl('/api/health')).toBe('/api/health');
  });

  it('returns relative path when VITE_API_URL is missing (placeholder rejected)', async () => {
    // VITE_API_URL not in process.env at all → import.meta.env.VITE_API_URL is undefined
    vi.stubEnv('VITE_API_URL', undefined);
    const { getApiUrl } = await import('../src/utils/api');
    expect(getApiUrl('/api/health')).toBe('/api/health');
  });

  it('trims trailing slashes from API URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://example.com///');
    const { getApiUrl } = await import('../src/utils/api');
    expect(getApiUrl('/api/health')).toBe('https://example.com/api/health');
  });

  it('prefers explicit apiBase option over default', async () => {
    vi.stubEnv('VITE_API_URL', 'https://default.example.com');
    const { getApiUrl } = await import('../src/utils/api');
    expect(getApiUrl('/api/data', { apiBase: 'https://explicit.example.com' })).toBe(
      'https://explicit.example.com/api/data',
    );
  });
});

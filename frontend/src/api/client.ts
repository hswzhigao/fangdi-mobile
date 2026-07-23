/**
 * API client — single fetch wrapper for all frontend API calls.
 * Pages must NOT call fetch directly; use apiGet/apiPost exclusively.
 *
 * - Relative /api paths in production (same-origin deployment).
 * - Validates ApiEnvelope shape before returning data.
 * - Converts network/parse/abort errors to ApiError.
 * - No response bodies in logs, error messages, or URL params.
 * - No credentials mode; no v-html for upstream content.
 */
import { getApiUrl } from '../utils/api';
import type { ApiEnvelope, ApiError, ApiErrorCode, ApiMeta, ApiResult } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json; charset=utf-8',
};

// ── ApiError factory ──────────────────────────────────────────────────────────

function makeApiError(
  code: ApiErrorCode,
  message: string,
  retryable: boolean,
  fallbackUrl?: string,
): ApiError {
  return { code, message, retryable, fallbackUrl };
}

function networkError(err: unknown): ApiError {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return makeApiError('UPSTREAM_TIMEOUT', '请求已取消或超时', true);
  }
  return makeApiError(
    'UPSTREAM_BAD_STATUS',
    '网络连接失败，请检查网络后重试',
    true,
  );
}

function parseError(): ApiError {
  return makeApiError('UPSTREAM_SCHEMA', '数据格式异常', false);
}

// ── Envelope validation ───────────────────────────────────────────────────────

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  // Must have 'ok' boolean.
  if (typeof obj.ok !== 'boolean') return false;

  if (obj.ok === true) {
    // Success envelope: must have 'data'.
    return 'data' in obj;
  }

  // Error envelope: must have 'error' object with code/message/retryable.
  if (typeof obj.error !== 'object' || obj.error === null) return false;
  const err = obj.error as Record<string, unknown>;
  return (
    typeof err.code === 'string' &&
    typeof err.message === 'string' &&
    typeof err.retryable === 'boolean'
  );
}

function validateEnvelope(raw: unknown): { ok: true; data: unknown; meta?: ApiMeta } | ApiError {
  if (!isApiEnvelope(raw)) {
    return parseError();
  }

  if (!raw.ok) {
    const err = (raw as { error: { code: string; message: string; retryable: boolean; fallbackUrl?: string } }).error;
    return makeApiError(
      err.code as ApiErrorCode,
      err.message,
      err.retryable,
      err.fallbackUrl,
    );
  }

  // Validate meta shape for safe consumption.
  const rawMeta = raw.meta as Record<string, unknown> | undefined;
  let meta: ApiMeta | undefined;
  if (rawMeta && typeof rawMeta.source === 'string' && typeof rawMeta.cached === 'boolean' && typeof rawMeta.fetchedAt === 'string') {
    const source = rawMeta.source === 'upstream' || rawMeta.source === 'fallback' ? rawMeta.source : 'upstream';
    meta = { source, cached: rawMeta.cached, fetchedAt: rawMeta.fetchedAt };
  }

  return { ok: true, data: raw.data, meta };
}

// ── Internal fetch with timeout ────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const existingSignal = init?.signal;

  // Merge external signal with timeout signal.
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort());
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      // No credentials — no cookies/tokens sent.
      credentials: 'omit',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * GET request to the API. Validates envelope and returns typed data + meta.
 * Throws ApiError on failure.
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  const url = getApiUrl(path);

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      signal,
    });
  } catch (err: unknown) {
    throw networkError(err);
  }

  // Check for HTML response (WAF challenge pages).
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw makeApiError(
      'UPSTREAM_BLOCKED',
      '原站正在进行访问验证，移动版无法代替验证',
      true,
    );
  }

  // Parse JSON.
  let raw: unknown;
  try {
    const text = await response.text();
    const trimmed = text.trim();

    // Additional check for HTML content even if content-type lied.
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
      throw makeApiError(
        'UPSTREAM_BLOCKED',
        '原站正在进行访问验证，移动版无法代替验证',
        true,
      );
    }

    raw = JSON.parse(trimmed);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      throw err as ApiError;
    }
    throw parseError();
  }

  // Validate envelope shape.
  const validated = validateEnvelope(raw);
  if ('code' in validated) {
    throw validated;
  }

  return { data: validated.data as T, meta: validated.meta };
}

/**
 * POST request to the API. Validates envelope and returns typed data + meta.
 * Throws ApiError on failure.
 * Body is sent as JSON; never includes sensitive values in logs.
 */
export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  const url = getApiUrl(path);

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    throw networkError(err);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw makeApiError(
      'UPSTREAM_BLOCKED',
      '原站正在进行访问验证，移动版无法代替验证',
      true,
    );
  }

  let raw: unknown;
  try {
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
      throw makeApiError(
        'UPSTREAM_BLOCKED',
        '原站正在进行访问验证，移动版无法代替验证',
        true,
      );
    }
    raw = JSON.parse(trimmed);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      throw err as ApiError;
    }
    throw parseError();
  }

  const validated = validateEnvelope(raw);
  if ('code' in validated) {
    throw validated;
  }

  return { data: validated.data as T, meta: validated.meta };
}

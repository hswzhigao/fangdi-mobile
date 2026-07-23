/**
 * Shared upstream fetch helper — fixed base URL, error mapping, safe parsing.
 * Never accepts a URL from user input; all URLs are hardcoded constants.
 */

import { jsonOk, jsonError } from '../http/envelope';
import type { ApiEnvelope } from '../http/envelope';
import { safeParseJson, requireObject, isNormalizerError } from './normalizers';
import type { NormalizerError } from './normalizers';

// ── Constants ────────────────────────────────────────────────────────────────

export const UPSTREAM_BASE = 'https://www.fangdi.com.cn';

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Fixed fallback URLs for each route. */
export const FALLBACK_URLS: Record<string, string> = {
  '/api/home': `${UPSTREAM_BASE}/`,
  '/api/notices': `${UPSTREAM_BASE}/`,
  '/api/trade': `${UPSTREAM_BASE}/trade/trade.html`,
  '/api/lease': `${UPSTREAM_BASE}/lease/lease.html`,
};

// ── Fetch with timeout ───────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw { code: 'UPSTREAM_TIMEOUT' as const, message: '上游响应超时，请稍后重试' };
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw { code: 'UPSTREAM_TIMEOUT' as const, message: '上游响应超时，请稍后重试' };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Fetch + parse ────────────────────────────────────────────────────────────

interface UpstreamError {
  code: 'UPSTREAM_BLOCKED' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_BAD_STATUS';
  message: string;
  retryable: boolean;
  fallbackUrl?: string;
}

/**
 * Fetch a fixed upstream URL and parse the JSON response.
 * Maps HTTP errors, timeouts, 412/challenge, and non-JSON to typed errors.
 * Returns parsed JSON on success.
 */
export async function fetchUpstreamJson(
  url: string,
  route: string,
  init?: RequestInit,
): Promise<unknown | UpstreamError | NormalizerError> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, init);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const typed = err as UpstreamError;
      return { ...typed, fallbackUrl: FALLBACK_URLS[route] };
    }
    return {
      code: 'UPSTREAM_BAD_STATUS',
      message: '上游请求失败',
      retryable: true,
      fallbackUrl: FALLBACK_URLS[route],
    };
  }

  // Check for 412 (WAF challenge) or other non-200 responses.
  if (response.status === 412) {
    return {
      code: 'UPSTREAM_BLOCKED',
      message: '原站正在进行访问验证，移动版无法代替验证',
      retryable: true,
      fallbackUrl: FALLBACK_URLS[route],
    };
  }

  if (!response.ok) {
    return {
      code: 'UPSTREAM_BAD_STATUS',
      message: `上游暂不可用 (${response.status})`,
      retryable: true,
      fallbackUrl: FALLBACK_URLS[route],
    };
  }

  const parsed = await safeParseJson(response);
  if (isNormalizerError(parsed)) {
    const err = parsed as NormalizerError;
    return { ...err, fallbackUrl: FALLBACK_URLS[route] };
  }
  return parsed;
}

// ── Response builders ────────────────────────────────────────────────────────

/**
 * Convert a fetch error (UpstreamError | NormalizerError) into an ApiEnvelope error Response.
 */
export function toErrorResponse(
  err: UpstreamError | NormalizerError,
  request?: Request,
): Response {
  return jsonError(err.code, err.message, err.fallbackUrl, request);
}

/**
 * Build a success ApiEnvelope response.
 */
export function toSuccessResponse<T>(
  data: T,
  cached: boolean,
  request?: Request,
): Response {
  const fetchedAt = new Date().toISOString();
  return jsonOk(
    data,
    { source: 'upstream', cached, fetchedAt },
    request,
  );
}

/**
 * Type guard for UpstreamError or NormalizerError.
 */
export function isUpstreamError(value: unknown): value is UpstreamError | NormalizerError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

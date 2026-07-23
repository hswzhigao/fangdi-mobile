/**
 * HTTP envelope types and helpers.
 * All API responses use the fixed ApiEnvelope contract; no raw upstream bodies.
 */

import { corsOrigin } from './cors';

// ── Error codes ────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'CAPTCHA_REQUIRED'
  | 'CAPTCHA_EXPIRED'
  | 'CAPTCHA_INVALID'
  | 'UPSTREAM_BLOCKED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_BAD_STATUS'
  | 'UPSTREAM_SCHEMA'
  | 'INTERNAL_ERROR';

// ── Envelope ────────────────────────────────────────────────────────────────

export type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
      meta?: { source: 'upstream' | 'fallback'; cached: boolean; fetchedAt: string };
    }
  | {
      ok: false;
      error: {
        code: ApiErrorCode;
        message: string;
        retryable: boolean;
        fallbackUrl?: string;
      };
    };

// ── Error metadata ─────────────────────────────────────────────────────────

interface ErrorInfo {
  status: number;
  retryable: boolean;
  defaultMessage: string;
}

const ERROR_MAP: Record<ApiErrorCode, ErrorInfo> = {
  BAD_REQUEST:            { status: 400, retryable: false, defaultMessage: '请求参数有误' },
  NOT_FOUND:              { status: 404, retryable: false, defaultMessage: '页面不存在' },
  METHOD_NOT_ALLOWED:     { status: 405, retryable: false, defaultMessage: '请求方法不支持' },
  RATE_LIMITED:           { status: 429, retryable: true,  defaultMessage: '请求过于频繁，请稍后重试' },
  CAPTCHA_REQUIRED:       { status: 428, retryable: false, defaultMessage: '需要输入验证码' },
  CAPTCHA_EXPIRED:        { status: 410, retryable: false, defaultMessage: '验证码已过期，请重新获取' },
  CAPTCHA_INVALID:        { status: 422, retryable: false, defaultMessage: '验证码输入错误' },
  UPSTREAM_BLOCKED:       { status: 502, retryable: true,  defaultMessage: '上游访问验证失败，请访问原站' },
  UPSTREAM_TIMEOUT:       { status: 504, retryable: true,  defaultMessage: '上游响应超时，请稍后重试' },
  UPSTREAM_BAD_STATUS:    { status: 502, retryable: true,  defaultMessage: '上游暂不可用' },
  UPSTREAM_SCHEMA:        { status: 502, retryable: false, defaultMessage: '数据格式暂不可识别' },
  INTERNAL_ERROR:         { status: 500, retryable: true,  defaultMessage: '服务器内部错误' },
};

/** Return HTTP status + retryable + default message for an error code. */
export function errorInfo(code: ApiErrorCode): ErrorInfo {
  return ERROR_MAP[code];
}

// ── Safe response helpers ───────────────────────────────────────────────────

/** Headers shared by every API response. Never include upstream headers. */
function safeHeaders(request?: Request): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  // Apply CORS if a request was provided.
  if (request) {
    const origin = corsOrigin(request);
    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
    }
  }
  // No Set-Cookie passthrough.
  return headers;
}

/**
 * Build a typed API response. Sets safe headers and JSON body.
 * Pass the incoming Request to apply CORS headers.
 */
export function json<T>(envelope: ApiEnvelope<T>, status: number, request?: Request): Response {
  return new Response(JSON.stringify(envelope), {
    status,
    headers: safeHeaders(request),
  });
}

/** Convenience: build a success response. */
export function jsonOk<T>(
  data: T,
  meta?: { source: 'upstream' | 'fallback'; cached: boolean; fetchedAt: string },
  request?: Request,
): Response {
  const envelope: ApiEnvelope<T> = meta ? { ok: true, data, meta } : { ok: true, data };
  return json(envelope, 200, request);
}

/** Convenience: build an error response with optional custom message and fallback URL. */
export function jsonError(
  code: ApiErrorCode,
  message?: string,
  fallbackUrl?: string,
  request?: Request,
): Response {
  const info = errorInfo(code);
  const envelope: ApiEnvelope<never> = {
    ok: false,
    error: {
      code,
      message: message ?? info.defaultMessage,
      retryable: info.retryable,
      ...(fallbackUrl ? { fallbackUrl } : {}),
    },
  };
  return json(envelope, info.status, request);
}

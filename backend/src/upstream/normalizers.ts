/**
 * Upstream JSON normalizers — safe HTML/text stripping, schema validation,
 * typed extraction. Never fabricates data; missing required fields → UPSTREAM_SCHEMA.
 */

import type { ApiErrorCode } from '../http/envelope';

// ── ApiError for normalizer failures ─────────────────────────────────────────

export interface NormalizerError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  fallbackUrl?: string;
}

// ── HTML stripping ───────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;
const HTML_ENTITY_RE = /&(?:[a-z]+|#\d+);/gi;
/** Strip entire <script>...</script> and <style>...</style> blocks before tag stripping. */
const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Entity lookup for common HTML entities. */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (match) => ENTITIES[match] ?? match);
}

/** Strip HTML tags, script/style blocks, and decode entities. Returns plain text. */
export function stripHtml(raw: string): string {
  // First remove entire script/style blocks (including their content).
  const noScript = raw.replace(SCRIPT_STYLE_RE, '');
  // Then strip remaining tags and decode entities.
  return decodeEntities(noScript.replace(HTML_TAG_RE, '')).trim();
}

// ── Safe field extraction ────────────────────────────────────────────────────

/** Extract a string, returning undefined for non-string or empty. */
export function safeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Extract a clean plain-text string, stripping HTML and truncating. */
export function safeText(value: unknown, maxLen = 200): string | undefined {
  const s = safeString(value);
  if (!s) return undefined;
  const plain = stripHtml(s);
  return plain.length > maxLen ? plain.slice(0, maxLen) : plain;
}

/** Extract a finite non-negative number, returning undefined for non-number. */
export function safeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/** Extract a safe id string matching [A-Za-z0-9_-]{1,80}. */
export function safeId(value: unknown): string | undefined {
  const s = safeString(value);
  if (!s) return undefined;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(s)) return undefined;
  return s;
}

/** Validate an ISO 8601-ish date string. */
export function safeDateString(value: unknown): string | undefined {
  const s = safeString(value);
  if (!s) return undefined;
  // Accept any string that parses as a valid date in ISO format
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return s;
}

/** Pick a string value from an object, or return undefined. */
export function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  return safeString(obj[key]);
}

/** Pick a number value from an object, or return undefined. */
export function pickNumber(obj: Record<string, unknown>, key: string): number | undefined {
  return safeNumber(obj[key]);
}

/** Pick a clean text value from an object, stripping HTML and truncating. */
export function pickText(obj: Record<string, unknown>, key: string, maxLen = 200): string | undefined {
  return safeText(obj[key], maxLen);
}

// ── JSON parsing ─────────────────────────────────────────────────────────────

/**
 * Safely parse a Response body as JSON. Returns the parsed value or a
 * NormalizerError describing the failure.
 */
export async function safeParseJson(response: Response): Promise<unknown | NormalizerError> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return {
      code: 'UPSTREAM_BAD_STATUS',
      message: '无法读取上游响应内容',
      retryable: true,
    };
  }

  // Reject content that looks like HTML (WAF challenge pages)
  const trimmed = text.trim();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
    return {
      code: 'UPSTREAM_BLOCKED',
      message: '上游返回验证页面，移动版无法代替验证',
      retryable: true,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      code: 'UPSTREAM_SCHEMA',
      message: '上游返回格式异常，无法识别',
      retryable: false,
    };
  }
}

/**
 * Ensure the parsed value is a plain object (not null, not array).
 * Returns the object or a NormalizerError.
 */
export function requireObject(input: unknown): Record<string, unknown> | NormalizerError {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      code: 'UPSTREAM_SCHEMA',
      message: '上游返回数据结构异常',
      retryable: false,
    };
  }
  return input as Record<string, unknown>;
}

/**
 * Ensure the parsed value is an array. Returns the array or a NormalizerError.
 */
export function requireArray(input: unknown): unknown[] | NormalizerError {
  if (!Array.isArray(input)) {
    return {
      code: 'UPSTREAM_SCHEMA',
      message: '上游返回数据结构异常，期望数组',
      retryable: false,
    };
  }
  return input;
}

/**
 * Type guard: is the value a NormalizerError?
 */
export function isNormalizerError(value: unknown): value is NormalizerError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'retryable' in value
  );
}

// ── Shared notice normalizer ──────────────────────────────────────────────────

import type { Notice } from './types';

/**
 * Normalize a raw upstream object into a Notice.
 * Returns null if the object lacks a valid id and title.
 * Used by both the home adapter and the notices adapter.
 */
export function normalizeNotice(raw: unknown): Notice | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id ?? r.ID ?? r.noticeId);
  const title = safeText(r.title ?? r.TITLE ?? r.noticeTitle, 200);
  if (!id || !title) return null;
  return {
    id,
    title,
    publishedAt: safeDateString(r.publishedAt ?? r.publishDate ?? r.createTime) ?? undefined,
    category: safeText(r.category ?? r.kind, 50),
    summary: safeText(r.summary ?? r.brief ?? r.content, 300),
    detailUrl: safeString(r.detailUrl ?? r.url) ?? undefined,
  };
}

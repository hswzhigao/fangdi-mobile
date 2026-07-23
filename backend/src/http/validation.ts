/**
 * Strict input validation for query params, path ids, text and captcha.
 * All helpers return a validation error string or null (valid).
 */

// ── Page parameters ─────────────────────────────────────────────────────────

const PAGE_MIN = 1;
const PAGE_MAX = 10000;
const PAGE_SIZE_MIN = 1;
const PAGE_SIZE_MAX = 20;

export interface PageParams {
  page: number;
  pageSize: number;
}

/**
 * Parse page & pageSize from URL query.
 * Rejects unknown keys, non-integer values, and out-of-range values.
 */
export function parsePageParams(url: URL): { ok: true; params: PageParams } | { ok: false; error: string } {
  const allowed = new Set(['page', 'pageSize']);

  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      return { ok: false, error: `不允许的查询参数: ${key}` };
    }
  }

  return validatePageFields(
    url.searchParams.get('page'),
    url.searchParams.get('pageSize'),
  );
}

function validatePageFields(
  rawPage: string | null,
  rawPageSize: string | null,
): { ok: true; params: PageParams } | { ok: false; error: string } {
  if (rawPage === null || rawPage.trim() === '') {
    return { ok: false, error: '缺少 page 参数' };
  }
  if (rawPageSize === null || rawPageSize.trim() === '') {
    return { ok: false, error: '缺少 pageSize 参数' };
  }

  const page = Number(rawPage);
  const pageSize = Number(rawPageSize);

  if (!Number.isSafeInteger(page) || page < PAGE_MIN || page > PAGE_MAX) {
    return { ok: false, error: `page 参数必须在 ${PAGE_MIN}-${PAGE_MAX} 之间，且为整数` };
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < PAGE_SIZE_MIN || pageSize > PAGE_SIZE_MAX) {
    return { ok: false, error: `pageSize 参数必须在 ${PAGE_SIZE_MIN}-${PAGE_SIZE_MAX} 之间，且为整数` };
  }

  return { ok: true, params: { page, pageSize } };
}

// ── ID validation ───────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function validateId(id: string): string | null {
  if (!ID_RE.test(id)) {
    return 'id 格式不正确，只允许字母、数字、下划线和连字符，长度 1-80';
  }
  return null;
}

// ── Text validation ─────────────────────────────────────────────────────────

const HTML_RE = /<[\s\S]*?>/;
const CONTROL_RE = /[\x00-\x1f\x7f]/;

export function validateText(value: string, maxLen = 80): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) {
    return `文本长度必须在 1-${maxLen} 之间`;
  }
  if (CONTROL_RE.test(trimmed)) {
    return '文本不允许包含控制字符';
  }
  if (HTML_RE.test(trimmed)) {
    return '文本不允许包含 HTML 标签';
  }
  return null;
}

// ── Captcha text ────────────────────────────────────────────────────────────

const CAPTCHA_RE = /^[A-Za-z0-9]{2,12}$/;

export function validateCaptchaText(value: string): string | null {
  if (!CAPTCHA_RE.test(value)) {
    return '验证码只允许 2-12 个字母或数字';
  }
  return null;
}

// ── Numeric validation ──────────────────────────────────────────────────────

export function validateFiniteNonNegative(value: number, fieldName: string): string | null {
  if (!Number.isFinite(value) || value < 0) {
    return `${fieldName} 必须为非负有限数值`;
  }
  return null;
}

export function validateMinMax(min: number, max: number, fieldName: string): string | null {
  const errMin = validateFiniteNonNegative(min, `${fieldName} 最小值`);
  if (errMin) return errMin;
  const errMax = validateFiniteNonNegative(max, `${fieldName} 最大值`);
  if (errMax) return errMax;
  if (min > max) {
    return `${fieldName} 最小值不能大于最大值`;
  }
  return null;
}

// ── Enum validation ─────────────────────────────────────────────────────────

export function validateEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fieldName: string,
): { ok: true; value: T | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: null }; // absent → optional
  if (allowed.includes(value as T)) return { ok: true, value: value as T };
  return { ok: false, error: `${fieldName} 参数值不合法，允许值: ${allowed.join(', ')}` };
}

export function requireEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fieldName: string,
): { ok: true; value: T } | { ok: false; error: string } {
  if (value === null || value === undefined) {
    return { ok: false, error: `缺少 ${fieldName} 参数` };
  }
  if (!allowed.includes(value as T)) {
    return { ok: false, error: `${fieldName} 参数值不合法，允许值: ${allowed.join(', ')}` };
  }
  return { ok: true, value: value as T };
}

// ── Query key whitelist ─────────────────────────────────────────────────────

/**
 * Check that a URLSearchParams only contains allowed keys (exact match).
 * Returns null on success, or an error string naming the first unknown key.
 */
export function validateQueryKeys(params: URLSearchParams, allowed: string[]): string | null {
  const set = new Set(allowed);
  for (const key of params.keys()) {
    if (!set.has(key)) {
      return `不允许的查询参数: ${key}`;
    }
  }
  return null;
}

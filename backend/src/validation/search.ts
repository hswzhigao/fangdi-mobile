/**
 * Search filter validation — strict allowlist for NewHouseFilter and OldHouseFilter.
 *
 * All keys are validated against fixed allowlists. Unknown keys, invalid types,
 * out-of-range values, and unsafe text all return BAD_REQUEST errors.
 * Never logs request body or captcha text.
 */

import type { NewHouseFilter, OldHouseFilter, PropertyType, HouseStatus } from '../upstream/types';
import { PROPERTY_TYPES, HOUSE_STATUSES } from '../upstream/types';
import { validateText, validateCaptchaText, validateId } from '../http/validation';

// ── Shared constants ────────────────────────────────────────────────────────

const MAX_AREA = 1_000_000; // 100万平米 — reasonable upper bound
const MAX_PRICE = 1_000_000_000; // 10亿 — reasonable upper bound
const PAGE_MIN = 1;
const PAGE_MAX = 10000;
const PAGE_SIZE_MIN = 1;
const PAGE_SIZE_MAX = 20;

// ── Result types ────────────────────────────────────────────────────────────

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

// ── Numeric helpers ─────────────────────────────────────────────────────────

function validateOptionalFiniteNonNegative(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return `${fieldName} 必须为非负有限数值`;
  }
  return null;
}

function validateOptionalMinMax(
  min: unknown,
  max: unknown,
  fieldName: string,
): string | null {
  const errMin = validateOptionalFiniteNonNegative(min, `${fieldName}最小值`);
  if (errMin) return errMin;
  const errMax = validateOptionalFiniteNonNegative(max, `${fieldName}最大值`);
  if (errMax) return errMax;
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    return `${fieldName}最小值不能大于最大值`;
  }
  return null;
}

function validateOptionalInt(
  value: unknown,
  fieldName: string,
  max: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) {
    return `${fieldName} 必须为 0-${max} 的整数`;
  }
  return null;
}

// ── Enum validation ─────────────────────────────────────────────────────────

function validateOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): { ok: true; value: T | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: `${fieldName} 参数类型不正确` };
  if (!allowed.includes(value as T)) {
    return { ok: false, error: `${fieldName} 参数值不合法，允许值: ${allowed.join(', ')}` };
  }
  return { ok: true, value: value as T };
}

// ── Body key whitelist ──────────────────────────────────────────────────────

function validateBodyKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): string | null {
  const set = new Set(allowed);
  for (const key of Object.keys(body)) {
    if (!set.has(key)) {
      return `不允许的参数: ${key}`;
    }
  }
  return null;
}

// ── NewHouseFilter validation ───────────────────────────────────────────────

const NEW_HOUSE_ALLOWED_KEYS = [
  'district', 'propertyType', 'status', 'minArea', 'maxArea',
  'projectName', 'page', 'pageSize', 'captchaSession', 'captchaText',
] as const;

export function validateNewHouseFilter(
  body: Record<string, unknown>,
): ValidationResult<NewHouseFilter> {
  // Check for unknown keys
  const keyErr = validateBodyKeys(body, NEW_HOUSE_ALLOWED_KEYS);
  if (keyErr) return { ok: false, error: keyErr };

  // Required fields
  if (typeof body.page !== 'number' || !Number.isSafeInteger(body.page) ||
      body.page < PAGE_MIN || body.page > PAGE_MAX) {
    return { ok: false, error: `page 必须在 ${PAGE_MIN}-${PAGE_MAX} 之间，且为整数` };
  }
  if (typeof body.pageSize !== 'number' || !Number.isSafeInteger(body.pageSize) ||
      body.pageSize < PAGE_SIZE_MIN || body.pageSize > PAGE_SIZE_MAX) {
    return { ok: false, error: `pageSize 必须在 ${PAGE_SIZE_MIN}-${PAGE_SIZE_MAX} 之间，且为整数` };
  }

  // Optional district
  if (body.district !== undefined) {
    if (typeof body.district !== 'string') {
      return { ok: false, error: 'district 必须为字符串' };
    }
    const err = validateText(body.district, 80);
    if (err) return { ok: false, error: `district: ${err}` };
  }

  // Optional propertyType
  const ptResult = validateOptionalEnum(body.propertyType, PROPERTY_TYPES, 'propertyType');
  if (!ptResult.ok) return { ok: false, error: ptResult.error };

  // Optional status
  const stResult = validateOptionalEnum(body.status, HOUSE_STATUSES, 'status');
  if (!stResult.ok) return { ok: false, error: stResult.error };

  // Optional area range
  const areaErr = validateOptionalMinMax(body.minArea, body.maxArea, '面积');
  if (areaErr) return { ok: false, error: areaErr };
  if (typeof body.minArea === 'number' && body.minArea > MAX_AREA) {
    return { ok: false, error: `面积最小值不能超过 ${MAX_AREA}` };
  }
  if (typeof body.maxArea === 'number' && body.maxArea > MAX_AREA) {
    return { ok: false, error: `面积最大值不能超过 ${MAX_AREA}` };
  }

  // Optional projectName
  if (body.projectName !== undefined) {
    if (typeof body.projectName !== 'string') {
      return { ok: false, error: 'projectName 必须为字符串' };
    }
    const err = validateText(body.projectName, 80);
    if (err) return { ok: false, error: `projectName: ${err}` };
  }

  // Optional captchaSession
  if (body.captchaSession !== undefined) {
    if (typeof body.captchaSession !== 'string') {
      return { ok: false, error: 'captchaSession 必须为字符串' };
    }
    const err = validateId(body.captchaSession);
    if (err) return { ok: false, error: `captchaSession: ${err}` };
  }

  // Optional captchaText
  if (body.captchaText !== undefined) {
    if (typeof body.captchaText !== 'string') {
      return { ok: false, error: 'captchaText 必须为字符串' };
    }
    const err = validateCaptchaText(body.captchaText);
    if (err) return { ok: false, error: `captchaText: ${err}` };
  }

  return {
    ok: true,
    value: {
      district: typeof body.district === 'string' ? body.district.trim() : undefined,
      propertyType: ptResult.value ?? undefined,
      status: stResult.value ?? undefined,
      minArea: typeof body.minArea === 'number' ? body.minArea : undefined,
      maxArea: typeof body.maxArea === 'number' ? body.maxArea : undefined,
      projectName: typeof body.projectName === 'string' ? body.projectName.trim() : undefined,
      page: body.page as number,
      pageSize: body.pageSize as number,
      captchaSession: typeof body.captchaSession === 'string' ? body.captchaSession.trim() : undefined,
      captchaText: typeof body.captchaText === 'string' ? body.captchaText.trim() : undefined,
    },
  };
}

// ── OldHouseFilter validation ───────────────────────────────────────────────

const OLD_HOUSE_ALLOWED_KEYS = [
  'district', 'minArea', 'maxArea', 'minPrice', 'maxPrice',
  'rooms', 'propertyType', 'keyword', 'page', 'pageSize',
  'captchaSession', 'captchaText',
] as const;

export function validateOldHouseFilter(
  body: Record<string, unknown>,
): ValidationResult<OldHouseFilter> {
  // Check for unknown keys
  const keyErr = validateBodyKeys(body, OLD_HOUSE_ALLOWED_KEYS);
  if (keyErr) return { ok: false, error: keyErr };

  // Required fields
  if (typeof body.page !== 'number' || !Number.isSafeInteger(body.page) ||
      body.page < PAGE_MIN || body.page > PAGE_MAX) {
    return { ok: false, error: `page 必须在 ${PAGE_MIN}-${PAGE_MAX} 之间，且为整数` };
  }
  if (typeof body.pageSize !== 'number' || !Number.isSafeInteger(body.pageSize) ||
      body.pageSize < PAGE_SIZE_MIN || body.pageSize > PAGE_SIZE_MAX) {
    return { ok: false, error: `pageSize 必须在 ${PAGE_SIZE_MIN}-${PAGE_SIZE_MAX} 之间，且为整数` };
  }

  // Optional district
  if (body.district !== undefined) {
    if (typeof body.district !== 'string') {
      return { ok: false, error: 'district 必须为字符串' };
    }
    const err = validateText(body.district, 80);
    if (err) return { ok: false, error: `district: ${err}` };
  }

  // Optional area range
  const areaErr = validateOptionalMinMax(body.minArea, body.maxArea, '面积');
  if (areaErr) return { ok: false, error: areaErr };
  if (typeof body.minArea === 'number' && body.minArea > MAX_AREA) {
    return { ok: false, error: `面积最小值不能超过 ${MAX_AREA}` };
  }
  if (typeof body.maxArea === 'number' && body.maxArea > MAX_AREA) {
    return { ok: false, error: `面积最大值不能超过 ${MAX_AREA}` };
  }

  // Optional price range
  const priceErr = validateOptionalMinMax(body.minPrice, body.maxPrice, '价格');
  if (priceErr) return { ok: false, error: priceErr };
  if (typeof body.minPrice === 'number' && body.minPrice > MAX_PRICE) {
    return { ok: false, error: `价格最小值不能超过 ${MAX_PRICE}` };
  }
  if (typeof body.maxPrice === 'number' && body.maxPrice > MAX_PRICE) {
    return { ok: false, error: `价格最大值不能超过 ${MAX_PRICE}` };
  }

  // Optional rooms
  const roomsErr = validateOptionalInt(body.rooms, 'rooms', 50);
  if (roomsErr) return { ok: false, error: roomsErr };

  // Optional propertyType
  const ptResult = validateOptionalEnum(body.propertyType, PROPERTY_TYPES, 'propertyType');
  if (!ptResult.ok) return { ok: false, error: ptResult.error };

  // Optional keyword
  if (body.keyword !== undefined) {
    if (typeof body.keyword !== 'string') {
      return { ok: false, error: 'keyword 必须为字符串' };
    }
    const err = validateText(body.keyword, 80);
    if (err) return { ok: false, error: `keyword: ${err}` };
  }

  // Optional captchaSession
  if (body.captchaSession !== undefined) {
    if (typeof body.captchaSession !== 'string') {
      return { ok: false, error: 'captchaSession 必须为字符串' };
    }
    const err = validateId(body.captchaSession);
    if (err) return { ok: false, error: `captchaSession: ${err}` };
  }

  // Optional captchaText
  if (body.captchaText !== undefined) {
    if (typeof body.captchaText !== 'string') {
      return { ok: false, error: 'captchaText 必须为字符串' };
    }
    const err = validateCaptchaText(body.captchaText);
    if (err) return { ok: false, error: `captchaText: ${err}` };
  }

  return {
    ok: true,
    value: {
      district: typeof body.district === 'string' ? body.district.trim() : undefined,
      minArea: typeof body.minArea === 'number' ? body.minArea : undefined,
      maxArea: typeof body.maxArea === 'number' ? body.maxArea : undefined,
      minPrice: typeof body.minPrice === 'number' ? body.minPrice : undefined,
      maxPrice: typeof body.maxPrice === 'number' ? body.maxPrice : undefined,
      rooms: typeof body.rooms === 'number' ? body.rooms : undefined,
      propertyType: ptResult.value ?? undefined,
      keyword: typeof body.keyword === 'string' ? body.keyword.trim() : undefined,
      page: body.page as number,
      pageSize: body.pageSize as number,
      captchaSession: typeof body.captchaSession === 'string' ? body.captchaSession.trim() : undefined,
      captchaText: typeof body.captchaText === 'string' ? body.captchaText.trim() : undefined,
    },
  };
}
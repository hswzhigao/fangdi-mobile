/**
 * Filter serialization/deserialization for NewHouseFilter and OldHouseFilter.
 *
 * - serializeFilter: converts a filter to URL query string, stripping captcha fields
 * - deserializeFilter: parses URLSearchParams into a validated filter, rejecting
 *   unknown/sensitive keys and clamping out-of-range values
 *
 * captchaSession and captchaText are NEVER serialized to URL — they exist only
 * in-memory during an active captcha session.
 */
import type { NewHouseFilter, OldHouseFilter, PropertyType, HouseStatus } from '../api/types';
import { PROPERTY_TYPES, HOUSE_STATUSES } from '../api/types';

// ── Allowed keys ────────────────────────────────────────────────────────────

const NEW_HOUSE_SAFE_KEYS = new Set([
  'district', 'propertyType', 'status', 'minArea', 'maxArea',
  'projectName', 'page', 'pageSize', 'type',
]);

const OLD_HOUSE_SAFE_KEYS = new Set([
  'district', 'minArea', 'maxArea', 'minPrice', 'maxPrice',
  'rooms', 'propertyType', 'keyword', 'page', 'pageSize', 'type',
]);

// ── Shared constants ────────────────────────────────────────────────────────

const MAX_AREA = 1_000_000;
const MAX_PRICE = 1_000_000_000;
const PAGE_MIN = 1;
const PAGE_MAX = 10000;
const PAGE_SIZE_MIN = 1;
const PAGE_SIZE_MAX = 20;

// ── Type helpers ────────────────────────────────────────────────────────────

function isPropertyType(v: string): v is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(v);
}

function isHouseStatus(v: string): v is HouseStatus {
  return (HOUSE_STATUSES as readonly string[]).includes(v);
}

function parseOptionalNumber(raw: string | null): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

// ── serializeFilter ─────────────────────────────────────────────────────────

/**
 * Serialize a filter to a URL-safe query string.
 * Captcha fields (captchaSession, captchaText) are NEVER included.
 * Values are URL-encoded.
 */
export function serializeFilter(filter: NewHouseFilter | OldHouseFilter): string {
  const params = new URLSearchParams();

  // Non-sensitive optional fields
  if (filter.district) params.set('district', filter.district);
  if ('propertyType' in filter && filter.propertyType) params.set('propertyType', filter.propertyType);
  if ('status' in filter && filter.status) params.set('status', filter.status);
  if (filter.minArea !== undefined) params.set('minArea', String(filter.minArea));
  if (filter.maxArea !== undefined) params.set('maxArea', String(filter.maxArea));
  if ('projectName' in filter && filter.projectName) params.set('projectName', filter.projectName);
  if ('minPrice' in filter && filter.minPrice !== undefined) params.set('minPrice', String(filter.minPrice));
  if ('maxPrice' in filter && filter.maxPrice !== undefined) params.set('maxPrice', String(filter.maxPrice));
  if ('rooms' in filter && filter.rooms !== undefined) params.set('rooms', String(filter.rooms));
  if ('keyword' in filter && filter.keyword) params.set('keyword', filter.keyword);

  // Pagination
  params.set('page', String(filter.page));
  params.set('pageSize', String(filter.pageSize));

  // Type marker
  if ('projectName' in filter) {
    params.set('type', 'new-house');
  } else {
    params.set('type', 'old-house');
  }

  // captchaSession and captchaText are NEVER added to URL

  return params.toString();
}

// ── deserializeFilter ───────────────────────────────────────────────────────

/**
 * Deserialize URLSearchParams into a validated NewHouseFilter or OldHouseFilter.
 *
 * - Only allowed keys are read; captchaSession/captchaText and unknown keys are rejected
 * - Page/pageSize are clamped to valid ranges
 * - Numeric fields are parsed as finite numbers; non-numeric strings are ignored
 * - Enum values are validated against allowlists
 * - min > max validation is applied
 */
export function deserializeFilter(query: URLSearchParams): NewHouseFilter | OldHouseFilter {
  const filterType = query.get('type');

  if (filterType === 'old-house') {
    return deserializeOldHouseFilter(query);
  }

  return deserializeNewHouseFilter(query);
}

function deserializeNewHouseFilter(query: URLSearchParams): NewHouseFilter {
  // Only read allowed keys
  const allowedParams = filterParams(query, NEW_HOUSE_SAFE_KEYS);

  const page = clampInt(parseOptionalNumber(allowedParams.get('page')), PAGE_MIN, PAGE_MAX, 1);
  const pageSize = clampInt(parseOptionalNumber(allowedParams.get('pageSize')), PAGE_SIZE_MIN, PAGE_SIZE_MAX, 10);

  const district = allowedParams.get('district')?.trim() || undefined;

  const propertyTypeRaw = allowedParams.get('propertyType');
  const propertyType = propertyTypeRaw && isPropertyType(propertyTypeRaw) ? propertyTypeRaw : undefined;

  const statusRaw = allowedParams.get('status');
  const status = statusRaw && isHouseStatus(statusRaw) ? statusRaw : undefined;

  let minArea = parseOptionalNumber(allowedParams.get('minArea'));
  let maxArea = parseOptionalNumber(allowedParams.get('maxArea'));

  // Validate min <= max
  if (minArea !== undefined && minArea < 0) minArea = undefined;
  if (maxArea !== undefined && maxArea < 0) maxArea = undefined;
  if (minArea !== undefined && minArea > MAX_AREA) minArea = undefined;
  if (maxArea !== undefined && maxArea > MAX_AREA) maxArea = undefined;
  if (minArea !== undefined && maxArea !== undefined && minArea > maxArea) {
    minArea = undefined;
    maxArea = undefined;
  }

  const projectName = allowedParams.get('projectName')?.trim() || undefined;

  return {
    district,
    propertyType,
    status,
    minArea,
    maxArea,
    projectName,
    page,
    pageSize,
  };
}

function deserializeOldHouseFilter(query: URLSearchParams): OldHouseFilter {
  const allowedParams = filterParams(query, OLD_HOUSE_SAFE_KEYS);

  const page = clampInt(parseOptionalNumber(allowedParams.get('page')), PAGE_MIN, PAGE_MAX, 1);
  const pageSize = clampInt(parseOptionalNumber(allowedParams.get('pageSize')), PAGE_SIZE_MIN, PAGE_SIZE_MAX, 10);

  const district = allowedParams.get('district')?.trim() || undefined;

  let minArea = parseOptionalNumber(allowedParams.get('minArea'));
  let maxArea = parseOptionalNumber(allowedParams.get('maxArea'));
  if (minArea !== undefined && minArea < 0) minArea = undefined;
  if (maxArea !== undefined && maxArea < 0) maxArea = undefined;
  if (minArea !== undefined && minArea > MAX_AREA) minArea = undefined;
  if (maxArea !== undefined && maxArea > MAX_AREA) maxArea = undefined;
  if (minArea !== undefined && maxArea !== undefined && minArea > maxArea) {
    minArea = undefined;
    maxArea = undefined;
  }

  let minPrice = parseOptionalNumber(allowedParams.get('minPrice'));
  let maxPrice = parseOptionalNumber(allowedParams.get('maxPrice'));
  if (minPrice !== undefined && minPrice < 0) minPrice = undefined;
  if (maxPrice !== undefined && maxPrice < 0) maxPrice = undefined;
  if (minPrice !== undefined && minPrice > MAX_PRICE) minPrice = undefined;
  if (maxPrice !== undefined && maxPrice > MAX_PRICE) maxPrice = undefined;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    minPrice = undefined;
    maxPrice = undefined;
  }

  let rooms = parseOptionalNumber(allowedParams.get('rooms'));
  if (rooms !== undefined && (!Number.isSafeInteger(rooms) || rooms < 0 || rooms > 50)) {
    rooms = undefined;
  }

  const propertyTypeRaw = allowedParams.get('propertyType');
  const propertyType = propertyTypeRaw && isPropertyType(propertyTypeRaw) ? propertyTypeRaw : undefined;

  const keyword = allowedParams.get('keyword')?.trim() || undefined;

  return {
    district,
    minArea,
    maxArea,
    minPrice,
    maxPrice,
    rooms,
    propertyType,
    keyword,
    page,
    pageSize,
  };
}

/**
 * Create a new URLSearchParams containing only allowed keys from the source.
 */
function filterParams(query: URLSearchParams, allowed: Set<string>): URLSearchParams {
  const result = new URLSearchParams();
  query.forEach((value, key) => {
    if (allowed.has(key)) {
      result.set(key, value);
    }
  });
  return result;
}

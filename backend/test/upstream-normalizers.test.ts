/**
 * Normalizer unit tests — schema validation, HTML stripping, safe field extraction.
 *
 * Tests cover: valid field mapping, missing optional fields, malformed data,
 * overlong titles, HTML stripping, unsafe text, and no raw upstream body in output.
 * These are pure function tests using sanitized fixtures — no network calls.
 */

import { describe, expect, it } from 'vitest';
import {
  stripHtml,
  safeString,
  safeText,
  safeNumber,
  safeId,
  safeDateString,
  pickString,
  pickNumber,
  pickText,
  safeParseJson,
  requireObject,
  requireArray,
  isNormalizerError,
} from '../src/upstream/normalizers';

import {
  VALID_NOTICE,
  VALID_HOUSE_SUMMARY,
  VALID_SELL_UPCOMING,
  VALID_BARGAIN,
  MALFORMED_NOTICE_MISSING_ID,
  UNSAFE_NOTICE_HTML_TITLE,
  OVERLONG_TITLE_NOTICE,
  EMPTY_HOME_RESPONSE,
  VALID_PROCLAMATION_LIST,
  VALID_POLICY_LIST,
  VALID_NEWS_LIST_WITH_HTML,
  VALID_YESTERDAY_SELL,
  MALFORMED_TRADE,
  CHALLENGE_HTML,
  NON_JSON_BODY,
} from './fixtures/content-fixtures';

// ═══════════════════════════════════════════════════════════════════════════
// stripHtml
// ═══════════════════════════════════════════════════════════════════════════

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtml('Price &lt; 100 &amp; &gt; 50')).toBe('Price < 100 & > 50');
  });

  it('handles plain text without tags', () => {
    expect(stripHtml('Plain text')).toBe('Plain text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('preserves Chinese text while stripping tags', () => {
    expect(stripHtml('<div>上海市住房保障通知</div>')).toBe('上海市住房保障通知');
  });

  it('strips nested tags', () => {
    expect(stripHtml('<div><span><b>Nested</b></span></div>')).toBe('Nested');
  });

  it('strips script tags and their content', () => {
    expect(stripHtml('<script>alert("xss")</script>important')).toBe('important');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// safeString
// ═══════════════════════════════════════════════════════════════════════════

describe('safeString', () => {
  it('returns the trimmed string for valid input', () => {
    expect(safeString('  hello  ')).toBe('hello');
  });

  it('returns undefined for empty string', () => {
    expect(safeString('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(safeString('   ')).toBeUndefined();
  });

  it('returns undefined for non-string', () => {
    expect(safeString(123)).toBeUndefined();
    expect(safeString(null)).toBeUndefined();
    expect(safeString(undefined)).toBeUndefined();
    expect(safeString({})).toBeUndefined();
    expect(safeString(true)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// safeText
// ═══════════════════════════════════════════════════════════════════════════

describe('safeText', () => {
  it('strips HTML and trims', () => {
    expect(safeText('<b>Hello World</b>')).toBe('Hello World');
  });

  it('truncates overlong text to default maxLen 200', () => {
    const long = 'A'.repeat(300);
    const result = safeText(long);
    expect(result).toHaveLength(200);
    expect(result).toBe('A'.repeat(200));
  });

  it('truncates overlong text to custom maxLen', () => {
    const long = 'A'.repeat(100);
    expect(safeText(long, 50)).toHaveLength(50);
  });

  it('returns undefined for non-string', () => {
    expect(safeText(123)).toBeUndefined();
    expect(safeText(null)).toBeUndefined();
  });

  it('handles overlong Chinese text correctly', () => {
    const title = '关于'.repeat(200); // 2 chars * 200 = 400 chars
    const result = safeText(title, 50);
    expect(result!.length).toBeLessThanOrEqual(50);
  });

  it('removes HTML and script content from overlong title', () => {
    const title = UNSAFE_NOTICE_HTML_TITLE.title;
    const result = safeText(title, 100);
    // Should not contain script tags or script content
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('xss');
    expect(result).toContain('Important Notice');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// safeNumber
// ═══════════════════════════════════════════════════════════════════════════

describe('safeNumber', () => {
  it('returns the number for valid finite non-negative', () => {
    expect(safeNumber(0)).toBe(0);
    expect(safeNumber(100)).toBe(100);
    expect(safeNumber(3.14)).toBe(3.14);
  });

  it('returns undefined for negative numbers', () => {
    expect(safeNumber(-1)).toBeUndefined();
  });

  it('returns undefined for non-numbers', () => {
    expect(safeNumber('100')).toBeUndefined();
    expect(safeNumber(null)).toBeUndefined();
    expect(safeNumber(undefined)).toBeUndefined();
    expect(safeNumber(NaN)).toBeUndefined();
    expect(safeNumber(Infinity)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// safeId
// ═══════════════════════════════════════════════════════════════════════════

describe('safeId', () => {
  it('accepts valid ids', () => {
    expect(safeId('abc-123')).toBe('abc-123');
    expect(safeId('ABC_456')).toBe('ABC_456');
    expect(safeId('a')).toBe('a');
    expect(safeId('a'.repeat(80))).toBe('a'.repeat(80));
  });

  it('rejects ids longer than 80 chars', () => {
    expect(safeId('a'.repeat(81))).toBeUndefined();
  });

  it('rejects ids with special characters', () => {
    expect(safeId('a/b')).toBeUndefined();
    expect(safeId('a.b')).toBeUndefined();
    expect(safeId('a b')).toBeUndefined();
    expect(safeId('<id>')).toBeUndefined();
  });

  it('rejects empty strings', () => {
    expect(safeId('')).toBeUndefined();
  });

  it('rejects non-string inputs', () => {
    expect(safeId(123)).toBeUndefined();
    expect(safeId(null)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// safeDateString
// ═══════════════════════════════════════════════════════════════════════════

describe('safeDateString', () => {
  it('accepts valid ISO 8601 dates', () => {
    expect(safeDateString('2026-07-01T08:00:00Z')).toBe('2026-07-01T08:00:00Z');
    expect(safeDateString('2026-07-01')).toBe('2026-07-01');
  });

  it('rejects non-date strings', () => {
    expect(safeDateString('not a date')).toBeUndefined();
    expect(safeDateString('')).toBeUndefined();
  });

  it('rejects non-string inputs', () => {
    expect(safeDateString(1234567890)).toBeUndefined();
    expect(safeDateString(null)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// pick helpers
// ═══════════════════════════════════════════════════════════════════════════

describe('pickString', () => {
  it('extracts string field from object', () => {
    expect(pickString({ name: 'hello' }, 'name')).toBe('hello');
  });

  it('returns undefined for missing field', () => {
    expect(pickString({}, 'name')).toBeUndefined();
  });

  it('returns undefined for non-string field', () => {
    expect(pickString({ name: 123 }, 'name')).toBeUndefined();
  });
});

describe('pickNumber', () => {
  it('extracts numeric field from object', () => {
    expect(pickNumber({ count: 5 }, 'count')).toBe(5);
  });

  it('returns undefined for missing field', () => {
    expect(pickNumber({}, 'count')).toBeUndefined();
  });

  it('returns undefined for non-numeric field', () => {
    expect(pickNumber({ count: '5' }, 'count')).toBeUndefined();
  });
});

describe('pickText', () => {
  it('extracts and sanitizes text field', () => {
    const obj = { title: '<b>Hello</b>' };
    expect(pickText(obj, 'title')).toBe('Hello');
  });

  it('truncates overlong text', () => {
    const obj = { title: 'A'.repeat(300) };
    const result = pickText(obj, 'title', 100);
    expect(result).toHaveLength(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// safeParseJson
// ═══════════════════════════════════════════════════════════════════════════

describe('safeParseJson', () => {
  it('parses valid JSON', async () => {
    const res = new Response(JSON.stringify(VALID_NOTICE));
    const parsed = await safeParseJson(res);
    expect(parsed).toEqual(VALID_NOTICE);
  });

  it('returns UPSTREAM_BLOCKED for HTML content (challenge page)', async () => {
    const res = new Response(CHALLENGE_HTML);
    const parsed = await safeParseJson(res);
    expect(isNormalizerError(parsed)).toBe(true);
    if (isNormalizerError(parsed)) {
      expect(parsed.code).toBe('UPSTREAM_BLOCKED');
      expect(parsed.message).toContain('验证');
    }
  });

  it('returns UPSTREAM_BLOCKED for HTML starting with <!', async () => {
    const res = new Response('<!doctype html><html></html>');
    const parsed = await safeParseJson(res);
    expect(isNormalizerError(parsed)).toBe(true);
    if (isNormalizerError(parsed)) {
      expect(parsed.code).toBe('UPSTREAM_BLOCKED');
    }
  });

  it('returns UPSTREAM_SCHEMA for non-JSON, non-HTML', async () => {
    const res = new Response(NON_JSON_BODY);
    const parsed = await safeParseJson(res);
    expect(isNormalizerError(parsed)).toBe(true);
    if (isNormalizerError(parsed)) {
      expect(parsed.code).toBe('UPSTREAM_SCHEMA');
    }
  });

  it('handles empty response body', async () => {
    const res = new Response('');
    const parsed = await safeParseJson(res);
    expect(isNormalizerError(parsed)).toBe(true);
    if (isNormalizerError(parsed)) {
      expect(parsed.code).toBe('UPSTREAM_SCHEMA');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// requireObject / requireArray
// ═══════════════════════════════════════════════════════════════════════════

describe('requireObject', () => {
  it('returns the object for valid input', () => {
    const obj = { a: 1 };
    const result = requireObject(obj);
    expect(isNormalizerError(result)).toBe(false);
    expect(result).toEqual(obj);
  });

  it('returns error for null', () => {
    const result = requireObject(null);
    expect(isNormalizerError(result)).toBe(true);
  });

  it('returns error for arrays', () => {
    const result = requireObject([1, 2, 3]);
    expect(isNormalizerError(result)).toBe(true);
  });

  it('returns error for primitives', () => {
    expect(isNormalizerError(requireObject('string'))).toBe(true);
    expect(isNormalizerError(requireObject(42))).toBe(true);
  });
});

describe('requireArray', () => {
  it('returns the array for valid input', () => {
    const arr = [1, 2, 3];
    const result = requireArray(arr);
    expect(isNormalizerError(result)).toBe(false);
    expect(result).toEqual(arr);
  });

  it('returns error for non-arrays', () => {
    expect(isNormalizerError(requireArray({}))).toBe(true);
    expect(isNormalizerError(requireArray('not array'))).toBe(true);
    expect(isNormalizerError(requireArray(null))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Fixture-based field extraction tests
// ═══════════════════════════════════════════════════════════════════════════

describe('fixture field extraction', () => {
  it('extracts valid notice fields', () => {
    const n = VALID_NOTICE as Record<string, unknown>;
    const id = safeId(n.noticeId);
    const title = safeText(n.title, 200);
    const date = safeDateString(n.publishDate);

    expect(id).toBe('abc-123-def');
    expect(title).toBe('关于2026年第三季度住房保障工作的通知');
    expect(date).toBe('2026-07-01T08:00:00Z');
  });

  it('rejects malformed notice missing id', () => {
    const n = MALFORMED_NOTICE_MISSING_ID as Record<string, unknown>;
    const id = safeId(n.noticeId ?? n.id);
    expect(id).toBeUndefined();
  });

  it('strips HTML and script content from notice title', () => {
    const n = UNSAFE_NOTICE_HTML_TITLE as Record<string, unknown>;
    const title = safeText(n.title, 200);
    expect(title).not.toContain('<script>');
    expect(title).not.toContain('alert');
    expect(title).not.toContain('xss');
    expect(title).toContain('Important Notice');
  });

  it('truncates overlong title to 200 chars', () => {
    const n = OVERLONG_TITLE_NOTICE as Record<string, unknown>;
    const title = safeText(n.title, 200);
    expect(title).toHaveLength(200);
  });

  it('extracts valid house summary fields', () => {
    const h = VALID_HOUSE_SUMMARY as Record<string, unknown>;
    const id = safeId(h.id);
    const name = safeText(h.name, 100);
    const district = safeText(h.district, 50);

    expect(id).toBe('proj-001');
    expect(name).toBe('金桥瑞仕花园');
    expect(district).toBe('浦东新区');
  });

  it('extracts valid trade metric fields', () => {
    const t = (VALID_YESTERDAY_SELL as Record<string, unknown>).newHouse as Record<string, unknown>;
    const count = safeNumber(t.count);
    const area = safeNumber(t.area);
    const avgPrice = safeNumber(t.averagePrice);

    expect(count).toBe(128);
    expect(area).toBe(13500.5);
    expect(avgPrice).toBe(62963);
  });

  it('rejects malformed trade with wrong types', () => {
    const t = MALFORMED_TRADE as Record<string, unknown>;
    const asOf = safeString(t.asOf); // should be string but is number
    expect(asOf).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isNormalizerError type guard
// ═══════════════════════════════════════════════════════════════════════════

describe('isNormalizerError', () => {
  it('returns true for NormalizerError objects', () => {
    const err = { code: 'UPSTREAM_SCHEMA' as const, message: 'test', retryable: false };
    expect(isNormalizerError(err)).toBe(true);
  });

  it('returns false for plain objects', () => {
    expect(isNormalizerError({})).toBe(false);
    expect(isNormalizerError({ code: 123 })).toBe(false);
  });

  it('returns false for null and primitives', () => {
    expect(isNormalizerError(null)).toBe(false);
    expect(isNormalizerError(undefined)).toBe(false);
    expect(isNormalizerError('error')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// normalizeNotice (shared normalizer used by home and notices adapters)
// ═══════════════════════════════════════════════════════════════════════════

import { normalizeNotice } from '../src/upstream/normalizers';

describe('normalizeNotice', () => {
  it('extracts valid notice from object with noticeId/title/publishDate', () => {
    const raw = VALID_NOTICE;
    const result = normalizeNotice(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('abc-123-def');
    expect(result!.title).toBe('关于2026年第三季度住房保障工作的通知');
    expect(result!.publishedAt).toBe('2026-07-01T08:00:00Z');
    expect(result!.category).toBe('policy');
  });

  it('handles alternate field names (ID/TITLE)', () => {
    const raw = { ID: 'alt-001', TITLE: 'Alternate Title', noticeTitle: 'ignored' };
    const result = normalizeNotice(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('alt-001');
    expect(result!.title).toBe('Alternate Title');
  });

  it('returns null for non-object input', () => {
    expect(normalizeNotice(null)).toBeNull();
    expect(normalizeNotice('string')).toBeNull();
    expect(normalizeNotice(123)).toBeNull();
  });

  it('returns null when id is missing', () => {
    const raw = { title: 'No ID', publishDate: '2026-01-01' };
    expect(normalizeNotice(raw)).toBeNull();
  });

  it('returns null when title is missing', () => {
    const raw = { id: 'has-id' };
    expect(normalizeNotice(raw)).toBeNull();
  });

  it('returns null when id is invalid (contains special chars)', () => {
    const raw = { id: 'bad/id', title: 'Title' };
    expect(normalizeNotice(raw)).toBeNull();
  });

  it('strips HTML from title', () => {
    const raw = { id: 'html-001', title: '<b>Important</b> Notice' };
    const result = normalizeNotice(raw);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Important Notice');
  });

  it('truncates overlong title to 200 chars', () => {
    const raw = { id: 'long-001', title: 'X'.repeat(500) };
    const result = normalizeNotice(raw);
    expect(result).not.toBeNull();
    expect(result!.title!.length).toBe(200);
  });

  it('returns notice with summary and detailUrl when provided', () => {
    const raw = {
      id: 'full-001',
      title: 'Full Notice',
      summary: 'This is a summary',
      detailUrl: '/detail/full-001',
    };
    const result = normalizeNotice(raw);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('This is a summary');
    expect(result!.detailUrl).toBe('/detail/full-001');
  });

  it('handles empty object', () => {
    expect(normalizeNotice({})).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// normalizeMarketSummary (old-house market summary normalizer)
// ═══════════════════════════════════════════════════════════════════════════

import { normalizeMarketSummary } from '../src/upstream/old-house';
import {
  VALID_MARKET_SUMMARY_RESPONSE,
  VALID_MARKET_SUMMARY_ALTERNATE,
  EMPTY_MARKET_SUMMARY_RESPONSE,
  MALFORMED_MARKET_SUMMARY,
  UNRELATED_GENERIC_MARKET_SUMMARY,
} from './fixtures/search-fixtures';

describe('normalizeMarketSummary', () => {
  it('extracts verified fields (sellcount, sellArea, totalAmount, averagePrice)', () => {
    const result = normalizeMarketSummary(VALID_MARKET_SUMMARY_RESPONSE);
    expect(result).not.toBeNull();
    expect(result!.sellCount).toBe(256);
    expect(result!.sellArea).toBe(22000.5);
    expect(result!.totalAmount).toBe(1200000000);
    expect(result!.averagePrice).toBe(54545);
    expect(result!.asOf).toBe('2026-07-22');
  });

  it('accepts case-variant aliases (sellCount, sellarea, totalamount, avgPrice)', () => {
    const result = normalizeMarketSummary(VALID_MARKET_SUMMARY_ALTERNATE);
    expect(result).not.toBeNull();
    expect(result!.sellCount).toBe(180);
    expect(result!.sellArea).toBe(15000);
    expect(result!.totalAmount).toBe(800000000);
    expect(result!.averagePrice).toBe(53333);
    expect(result!.asOf).toBe('2026-07-22');
  });

  it('returns null for unrelated generic keys (count, area, amount, avgprice)', () => {
    const result = normalizeMarketSummary(UNRELATED_GENERIC_MARKET_SUMMARY);
    expect(result).toBeNull();
  });

  it('returns null for empty/missing data', () => {
    expect(normalizeMarketSummary(EMPTY_MARKET_SUMMARY_RESPONSE)).toBeNull();
  });

  it('returns null for malformed data (wrong types)', () => {
    expect(normalizeMarketSummary(MALFORMED_MARKET_SUMMARY)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizeMarketSummary(null)).toBeNull();
    expect(normalizeMarketSummary('string')).toBeNull();
    expect(normalizeMarketSummary(123)).toBeNull();
  });
});

/**
 * Filter state tests — serializeFilter/deserializeFilter, page reset,
 * allowed keys, no sensitive persistence, URL encoding, cross-page type safety.
 */
import { describe, it, expect } from 'vitest';
import { serializeFilter, deserializeFilter } from '../src/utils/filter';
import type { NewHouseFilter, OldHouseFilter } from '../src/api/types';

// ── serializeFilter ──────────────────────────────────────────────────────────

describe('serializeFilter', () => {
  it('serializes NewHouseFilter to URL-safe string without captcha fields', () => {
    const filter: NewHouseFilter = {
      district: '浦东新区',
      propertyType: 'residential',
      status: 'available',
      minArea: 50,
      maxArea: 150,
      projectName: '测试楼盘',
      page: 1,
      pageSize: 10,
      captchaSession: 'abc123',
      captchaText: 'ABCD',
    };

    const serialized = serializeFilter(filter);

    // Must be a string
    expect(typeof serialized).toBe('string');

    // Parse back to verify all non-sensitive fields are present (URLSearchParams encodes non-ASCII)
    const params = new URLSearchParams(serialized);
    expect(params.get('district')).toBe('浦东新区');
    expect(params.get('propertyType')).toBe('residential');
    expect(params.get('status')).toBe('available');
    expect(params.get('minArea')).toBe('50');
    expect(params.get('maxArea')).toBe('150');
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('10');

    // Must NOT contain captcha session or text
    expect(serialized).not.toContain('abc123');
    expect(serialized).not.toContain('ABCD');
    expect(serialized).not.toContain('captchaSession');
    expect(serialized).not.toContain('captchaText');
  });

  it('serializes OldHouseFilter to URL-safe string without captcha fields', () => {
    const filter: OldHouseFilter = {
      district: '徐汇区',
      minArea: 60,
      maxArea: 200,
      minPrice: 1000000,
      maxPrice: 5000000,
      rooms: 3,
      propertyType: 'commercial',
      keyword: '花园',
      page: 2,
      pageSize: 20,
      captchaSession: 'sess123',
      captchaText: 'XY12',
    };

    const serialized = serializeFilter(filter);

    expect(typeof serialized).toBe('string');
    expect(serialized).toContain('page=2');
    expect(serialized).toContain('pageSize=20');

    // Must NOT contain captcha session or text
    expect(serialized).not.toContain('sess123');
    expect(serialized).not.toContain('XY12');
    expect(serialized).not.toContain('captchaSession');
    expect(serialized).not.toContain('captchaText');
  });

  it('URL-encodes special characters in filter values', () => {
    const filter: NewHouseFilter = {
      projectName: 'test & value',
      page: 1,
      pageSize: 10,
    };

    const serialized = serializeFilter(filter);
    expect(serialized).not.toContain('test & value');
    // & should be encoded (URLSearchParams uses + for spaces in x-www-form-urlencoded)
    const params = new URLSearchParams(serialized);
    expect(params.get('projectName')).toBe('test & value');
  });

  it('omits undefined optional fields', () => {
    const filter: NewHouseFilter = {
      page: 1,
      pageSize: 10,
    };

    const serialized = serializeFilter(filter);
    expect(serialized).toContain('page=1');
    expect(serialized).toContain('pageSize=10');
    expect(serialized).not.toContain('district');
    expect(serialized).not.toContain('propertyType');
    expect(serialized).not.toContain('status');
    expect(serialized).not.toContain('minArea');
    expect(serialized).not.toContain('maxArea');
    expect(serialized).not.toContain('projectName');
  });
});

// ── deserializeFilter ────────────────────────────────────────────────────────

describe('deserializeFilter', () => {
  it('deserializes URLSearchParams to NewHouseFilter', () => {
    const params = new URLSearchParams(
      'district=%E6%B5%A6%E4%B8%9C&propertyType=residential&status=available&minArea=50&maxArea=150&projectName=%E6%B5%8B%E8%AF%95&page=1&pageSize=10&type=new-house',
    );

    const filter = deserializeFilter(params);

    expect(filter.district).toBe('浦东');
    expect(filter.propertyType).toBe('residential');
    expect(filter.status).toBe('available');
    expect((filter as NewHouseFilter).minArea).toBe(50);
    expect((filter as NewHouseFilter).maxArea).toBe(150);
    expect((filter as NewHouseFilter).projectName).toBe('测试');
    expect(filter.page).toBe(1);
    expect(filter.pageSize).toBe(10);
  });

  it('deserializes URLSearchParams to OldHouseFilter when type is old-house', () => {
    const params = new URLSearchParams(
      'minPrice=1000000&maxPrice=5000000&rooms=3&keyword=%E8%8A%B1%E5%9B%AD&page=2&pageSize=20&type=old-house',
    );

    const filter = deserializeFilter(params);

    const oldFilter = filter as OldHouseFilter;
    expect(oldFilter.minPrice).toBe(1000000);
    expect(oldFilter.maxPrice).toBe(5000000);
    expect(oldFilter.rooms).toBe(3);
    expect(oldFilter.keyword).toBe('花园');
    expect(filter.page).toBe(2);
    expect(filter.pageSize).toBe(20);
  });

  it('defaults to new-house type when type is missing', () => {
    const params = new URLSearchParams('page=3&pageSize=15');

    const filter = deserializeFilter(params);

    expect(filter.page).toBe(3);
    expect(filter.pageSize).toBe(15);
    // Should be NewHouseFilter by default
    expect('district' in filter || 'projectName' in filter).toBe(true);
  });

  it('rejects illegal keys not in allowlist', () => {
    const params = new URLSearchParams(
      'page=1&pageSize=10&hacked=evil&captchaSession=leak&captchaText=code',
    );

    const filter = deserializeFilter(params);

    // Must not include unknown or sensitive keys
    const filterObj = filter as Record<string, unknown>;
    expect(filterObj.hacked).toBeUndefined();
    expect(filterObj.captchaSession).toBeUndefined();
    expect(filterObj.captchaText).toBeUndefined();
    // Only allowed keys present
    expect(filter.page).toBe(1);
    expect(filter.pageSize).toBe(10);
  });

  it('defaults page to 1 and pageSize to 10 when missing', () => {
    const params = new URLSearchParams('');

    const filter = deserializeFilter(params);

    expect(filter.page).toBe(1);
    expect(filter.pageSize).toBe(10);
  });

  it('clamps page and pageSize to valid ranges', () => {
    const params = new URLSearchParams('page=99999&pageSize=999');

    const filter = deserializeFilter(params);

    expect(filter.page).toBeLessThanOrEqual(10000);
    expect(filter.page).toBeGreaterThanOrEqual(1);
    expect(filter.pageSize).toBeLessThanOrEqual(20);
    expect(filter.pageSize).toBeGreaterThanOrEqual(1);
  });

  it('ignores non-numeric values for numeric fields', () => {
    const params = new URLSearchParams('minArea=abc&maxArea=def&page=1&pageSize=10');

    const filter = deserializeFilter(params);

    const nf = filter as NewHouseFilter;
    expect(nf.minArea).toBeUndefined();
    expect(nf.maxArea).toBeUndefined();
  });

  it('validates min <= max for area fields', () => {
    const params = new URLSearchParams('minArea=200&maxArea=100&page=1&pageSize=10');

    const filter = deserializeFilter(params) as NewHouseFilter;

    // min > max: both should be dropped or max capped
    if (filter.minArea !== undefined && filter.maxArea !== undefined) {
      expect(filter.minArea).toBeLessThanOrEqual(filter.maxArea);
    }
  });

  // ── Cross-page type safety ─────────────────────────────────────────────────

  it('ignores old-house-specific fields when type is forced to new-house', () => {
    // Simulate NewHouse page forcing type=new-house on a URL that has old-house marker and fields
    const params = new URLSearchParams('type=old-house&minPrice=1000000&rooms=3&keyword=%E8%8A%B1%E5%9B%AD&district=%E6%B5%A6%E4%B8%9C&page=2&pageSize=20');
    params.set('type', 'new-house');
    const filter = deserializeFilter(params) as NewHouseFilter;

    // Shared field survives
    expect(filter.district).toBe('浦东');
    expect(filter.page).toBe(2);
    // Old-house-specific fields must not appear
    expect((filter as Record<string, unknown>).minPrice).toBeUndefined();
    expect((filter as Record<string, unknown>).rooms).toBeUndefined();
    expect((filter as Record<string, unknown>).keyword).toBeUndefined();
    // New-house-specific key works normally
    expect(filter.projectName).toBeUndefined();
  });

  it('ignores new-house-specific fields when type is forced to old-house', () => {
    // Simulate OldHouse page forcing type=old-house on a URL that has new-house marker and fields
    const params = new URLSearchParams('type=new-house&projectName=%E6%B5%8B%E8%AF%95%E6%A5%BC%E7%9B%98&status=available&district=%E5%BE%90%E6%B1%87&minArea=60&page=3&pageSize=15');
    params.set('type', 'old-house');
    const filter = deserializeFilter(params) as OldHouseFilter;

    // Shared fields survive
    expect(filter.district).toBe('徐汇');
    expect(filter.minArea).toBe(60);
    expect(filter.page).toBe(3);
    // New-house-specific fields must not appear
    expect((filter as Record<string, unknown>).projectName).toBeUndefined();
    expect((filter as Record<string, unknown>).status).toBeUndefined();
  });
});

// ── No sensitive persistence in URL ──────────────────────────────────────────

describe('no sensitive data in URL', () => {
  it('serializeFilter never includes sessionId', () => {
    const filter: NewHouseFilter = {
      page: 1,
      pageSize: 10,
      captchaSession: 'secret-session-id-12345',
      captchaText: 'ABC123',
    };

    const serialized = serializeFilter(filter);

    // sessionId must never appear in serialized URL string
    expect(serialized).not.toMatch(/secret-session-id-12345/i);
    expect(serialized).not.toMatch(/captchaSession/i);
    expect(serialized).not.toMatch(/ABC123/i);
    expect(serialized).not.toMatch(/captchaText/i);
  });

  it('serializeFilter never includes captcha text', () => {
    const filter: OldHouseFilter = {
      page: 1,
      pageSize: 10,
      captchaSession: 'any-session',
      captchaText: 'ABCDE',
    };

    const serialized = serializeFilter(filter);
    expect(serialized).not.toMatch(/ABCDE/i);
    expect(serialized).not.toMatch(/captchaText/i);
  });

  it('deserializeFilter strips captcha fields from URL params', () => {
    const params = new URLSearchParams(
      'captchaSession=leaked&captchaText=CODE&page=1&pageSize=10',
    );

    const filter = deserializeFilter(params);
    const f = filter as Record<string, unknown>;

    expect(f.captchaSession).toBeUndefined();
    expect(f.captchaText).toBeUndefined();
    expect(f.page).toBe(1);
  });
});

// ── Page reset on filter changes ─────────────────────────────────────────────

describe('page reset behavior', () => {
  it('serializeFilter always uses provided page value (caller controls reset)', () => {
    const filter: NewHouseFilter = {
      page: 5,
      pageSize: 10,
    };

    const serialized = serializeFilter(filter);
    const params = new URLSearchParams(serialized);
    const deserialized = deserializeFilter(params);

    // Page is preserved as-is; caller is responsible for resetting page
    expect(deserialized.page).toBe(5);
  });

  it('deserializeFilter respects page from URL', () => {
    const params = new URLSearchParams('page=3&pageSize=10&type=new-house');

    const filter = deserializeFilter(params);
    expect(filter.page).toBe(3);
  });
});

// ── Round-trip integrity ─────────────────────────────────────────────────────

describe('filter round-trip', () => {
  it('NewHouseFilter round-trip preserves non-sensitive fields', () => {
    const original: NewHouseFilter = {
      district: '浦东新区',
      propertyType: 'residential',
      status: 'available',
      minArea: 50,
      maxArea: 150,
      projectName: '测试楼盘',
      page: 1,
      pageSize: 10,
    };

    const serialized = serializeFilter(original);
    const params = new URLSearchParams(serialized);
    const restored = deserializeFilter(params) as NewHouseFilter;

    expect(restored.district).toBe(original.district);
    expect(restored.propertyType).toBe(original.propertyType);
    expect(restored.status).toBe(original.status);
    expect(restored.minArea).toBe(original.minArea);
    expect(restored.maxArea).toBe(original.maxArea);
    expect(restored.projectName).toBe(original.projectName);
    expect(restored.page).toBe(original.page);
    expect(restored.pageSize).toBe(original.pageSize);
  });

  it('OldHouseFilter round-trip preserves non-sensitive fields', () => {
    const original: OldHouseFilter = {
      district: '徐汇区',
      minPrice: 1000000,
      maxPrice: 5000000,
      rooms: 3,
      propertyType: 'commercial',
      keyword: '花园',
      minArea: 60,
      maxArea: 200,
      page: 2,
      pageSize: 20,
    };

    const serialized = serializeFilter(original);
    const params = new URLSearchParams(serialized);
    const restored = deserializeFilter(params) as OldHouseFilter;

    expect(restored.district).toBe(original.district);
    expect(restored.minPrice).toBe(original.minPrice);
    expect(restored.maxPrice).toBe(original.maxPrice);
    expect(restored.rooms).toBe(original.rooms);
    expect(restored.propertyType).toBe(original.propertyType);
    expect(restored.keyword).toBe(original.keyword);
    expect(restored.minArea).toBe(original.minArea);
    expect(restored.maxArea).toBe(original.maxArea);
    expect(restored.page).toBe(original.page);
    expect(restored.pageSize).toBe(original.pageSize);
  });
});
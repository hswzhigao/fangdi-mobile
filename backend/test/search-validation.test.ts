/**
 * Search validation tests — validateNewHouseFilter, validateOldHouseFilter.
 *
 * Covers: valid minimal/full/captcha filters, unknown keys, out-of-range values,
 * invalid enums, inverted ranges, HTML/control chars in text, invalid captcha
 * and session IDs, missing required fields, and edge cases.
 */

import { describe, expect, it } from 'vitest';
import {
  validateNewHouseFilter,
  validateOldHouseFilter,
} from '../src/validation/search';

import {
  VALID_NEW_HOUSE_FILTER_MINIMAL,
  VALID_NEW_HOUSE_FILTER_FULL,
  VALID_NEW_HOUSE_FILTER_CAPTCHA,
  INVALID_NEW_HOUSE_FILTER_UNKNOWN_KEY,
  INVALID_NEW_HOUSE_FILTER_PAGE_NEGATIVE,
  INVALID_NEW_HOUSE_FILTER_PAGE_TOO_LARGE,
  INVALID_NEW_HOUSE_FILTER_PAGE_SIZE_TOO_LARGE,
  INVALID_NEW_HOUSE_FILTER_PAGE_FLOAT,
  INVALID_NEW_HOUSE_FILTER_NO_PAGE,
  INVALID_NEW_HOUSE_FILTER_NO_PAGE_SIZE,
  INVALID_NEW_HOUSE_FILTER_BAD_PROPERTY_TYPE,
  INVALID_NEW_HOUSE_FILTER_BAD_STATUS,
  INVALID_NEW_HOUSE_FILTER_AREA_REVERSED,
  INVALID_NEW_HOUSE_FILTER_AREA_TOO_LARGE,
  INVALID_NEW_HOUSE_FILTER_MAX_AREA_TOO_LARGE,
  INVALID_NEW_HOUSE_FILTER_BAD_CAPTCHA_TEXT,
  INVALID_NEW_HOUSE_FILTER_BAD_CAPTCHA_SESSION,
  INVALID_NEW_HOUSE_FILTER_HTML_PROJECT_NAME,
  INVALID_NEW_HOUSE_FILTER_CONTROL_DISTRICT,
  INVALID_NEW_HOUSE_FILTER_PAGE_SIZE_ZERO,
  INVALID_NEW_HOUSE_FILTER_NEGATIVE_AREA,
  VALID_OLD_HOUSE_FILTER_MINIMAL,
  VALID_OLD_HOUSE_FILTER_FULL,
  INVALID_OLD_HOUSE_FILTER_UNKNOWN_KEY,
  INVALID_OLD_HOUSE_FILTER_PRICE_REVERSED,
  INVALID_OLD_HOUSE_FILTER_ROOMS_FLOAT,
  INVALID_OLD_HOUSE_FILTER_ROOMS_TOO_LARGE,
  INVALID_OLD_HOUSE_FILTER_PRICE_TOO_LARGE,
  INVALID_OLD_HOUSE_FILTER_HTML_KEYWORD,
} from './fixtures/search-fixtures';

// ═══════════════════════════════════════════════════════════════════════════
// validateNewHouseFilter
// ═══════════════════════════════════════════════════════════════════════════

describe('validateNewHouseFilter', () => {
  // ── Valid inputs ────────────────────────────────────────────────────────

  it('accepts minimal valid filter', () => {
    const result = validateNewHouseFilter(VALID_NEW_HOUSE_FILTER_MINIMAL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.page).toBe(1);
      expect(result.value.pageSize).toBe(10);
    }
  });

  it('accepts full valid filter', () => {
    const result = validateNewHouseFilter(VALID_NEW_HOUSE_FILTER_FULL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.district).toBe('浦东新区');
      expect(result.value.propertyType).toBe('residential');
      expect(result.value.status).toBe('available');
      expect(result.value.minArea).toBe(50);
      expect(result.value.maxArea).toBe(200);
      expect(result.value.projectName).toBe('金桥瑞仕');
      expect(result.value.page).toBe(1);
      expect(result.value.pageSize).toBe(20);
    }
  });

  it('accepts filter with valid captcha fields', () => {
    const result = validateNewHouseFilter(VALID_NEW_HOUSE_FILTER_CAPTCHA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.captchaSession).toBe('abc123-validSessionId_2024');
      expect(result.value.captchaText).toBe('A1b2C3');
    }
  });

  it('accepts filter with page=10000 boundary', () => {
    const result = validateNewHouseFilter({ page: 10000, pageSize: 1 });
    expect(result.ok).toBe(true);
  });

  it('accepts filter with pageSize=20 boundary', () => {
    const result = validateNewHouseFilter({ page: 1, pageSize: 20 });
    expect(result.ok).toBe(true);
  });

  it('accepts filter with pageSize=1 boundary', () => {
    const result = validateNewHouseFilter({ page: 1, pageSize: 1 });
    expect(result.ok).toBe(true);
  });

  // ── Invalid: unknown keys ───────────────────────────────────────────────

  it('rejects filter with unknown key', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_UNKNOWN_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('不允许的参数');
    }
  });

  // ── Invalid: page/pageSize ──────────────────────────────────────────────

  it('rejects negative page', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_PAGE_NEGATIVE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('page');
    }
  });

  it('rejects page too large', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_PAGE_TOO_LARGE);
    expect(result.ok).toBe(false);
  });

  it('rejects pageSize too large', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_PAGE_SIZE_TOO_LARGE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('pageSize');
    }
  });

  it('rejects float page', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_PAGE_FLOAT);
    expect(result.ok).toBe(false);
  });

  it('rejects missing page', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_NO_PAGE);
    expect(result.ok).toBe(false);
  });

  it('rejects missing pageSize', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_NO_PAGE_SIZE);
    expect(result.ok).toBe(false);
  });

  it('rejects pageSize = 0', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_PAGE_SIZE_ZERO);
    expect(result.ok).toBe(false);
  });

  // ── Invalid: enums ──────────────────────────────────────────────────────

  it('rejects invalid propertyType', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_BAD_PROPERTY_TYPE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('propertyType');
    }
  });

  it('rejects invalid status', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_BAD_STATUS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('status');
    }
  });

  // ── Invalid: area range ─────────────────────────────────────────────────

  it('rejects minArea > maxArea', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_AREA_REVERSED);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('最小值不能大于最大值');
    }
  });

  it('rejects minArea too large', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_AREA_TOO_LARGE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('面积最小值');
    }
  });

  it('rejects maxArea too large', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_MAX_AREA_TOO_LARGE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('面积最大值');
    }
  });

  it('rejects negative minArea', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_NEGATIVE_AREA);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('非负');
    }
  });

  // ── Invalid: captcha ────────────────────────────────────────────────────

  it('rejects invalid captcha text (special chars)', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_BAD_CAPTCHA_TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('captchaText');
    }
  });

  it('rejects invalid captcha session id', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_BAD_CAPTCHA_SESSION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('captchaSession');
    }
  });

  // ── Invalid: unsafe text ────────────────────────────────────────────────

  it('rejects projectName with HTML', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_HTML_PROJECT_NAME);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('HTML');
    }
  });

  it('rejects district with control characters', () => {
    const result = validateNewHouseFilter(INVALID_NEW_HOUSE_FILTER_CONTROL_DISTRICT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('控制字符');
    }
  });

  // ── Edge: optional fields undefined ─────────────────────────────────────

  it('allows undefined optional fields', () => {
    const result = validateNewHouseFilter({ page: 1, pageSize: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.district).toBeUndefined();
      expect(result.value.propertyType).toBeUndefined();
      expect(result.value.status).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateOldHouseFilter
// ═══════════════════════════════════════════════════════════════════════════

describe('validateOldHouseFilter', () => {
  // ── Valid inputs ────────────────────────────────────────────────────────

  it('accepts minimal valid filter', () => {
    const result = validateOldHouseFilter(VALID_OLD_HOUSE_FILTER_MINIMAL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.page).toBe(1);
      expect(result.value.pageSize).toBe(10);
    }
  });

  it('accepts full valid filter', () => {
    const result = validateOldHouseFilter(VALID_OLD_HOUSE_FILTER_FULL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.district).toBe('徐汇区');
      expect(result.value.minArea).toBe(60);
      expect(result.value.maxArea).toBe(120);
      expect(result.value.minPrice).toBe(1000000);
      expect(result.value.maxPrice).toBe(5000000);
      expect(result.value.rooms).toBe(3);
      expect(result.value.propertyType).toBe('residential');
      expect(result.value.keyword).toBe('地铁');
    }
  });

  // ── Invalid: unknown keys ───────────────────────────────────────────────

  it('rejects filter with unknown key', () => {
    const result = validateOldHouseFilter(INVALID_OLD_HOUSE_FILTER_UNKNOWN_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('不允许的参数');
    }
  });

  // ── Invalid: price range ────────────────────────────────────────────────

  it('rejects minPrice > maxPrice', () => {
    const result = validateOldHouseFilter(INVALID_OLD_HOUSE_FILTER_PRICE_REVERSED);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('最小值不能大于最大值');
    }
  });

  it('rejects price too large', () => {
    const result = validateOldHouseFilter(INVALID_OLD_HOUSE_FILTER_PRICE_TOO_LARGE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('价格最大值');
    }
  });

  // ── Invalid: rooms ──────────────────────────────────────────────────────

  it('rejects float rooms', () => {
    const result = validateOldHouseFilter(INVALID_OLD_HOUSE_FILTER_ROOMS_FLOAT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('rooms');
    }
  });

  it('rejects rooms too large', () => {
    const result = validateOldHouseFilter(INVALID_OLD_HOUSE_FILTER_ROOMS_TOO_LARGE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('rooms');
    }
  });

  it('rejects negative rooms', () => {
    const result = validateOldHouseFilter({ page: 1, pageSize: 10, rooms: -1 });
    expect(result.ok).toBe(false);
  });

  // ── Invalid: unsafe text ────────────────────────────────────────────────

  it('rejects keyword with HTML', () => {
    const result = validateOldHouseFilter(INVALID_OLD_HOUSE_FILTER_HTML_KEYWORD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('HTML');
    }
  });

  // ── Boundary tests ──────────────────────────────────────────────────────

  it('accepts rooms=0 (studio)', () => {
    const result = validateOldHouseFilter({ page: 1, pageSize: 10, rooms: 0 });
    expect(result.ok).toBe(true);
  });

  it('accepts rooms=50 (max)', () => {
    const result = validateOldHouseFilter({ page: 1, pageSize: 10, rooms: 50 });
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-filter identity: NewHouseFilter rejects OldHouseFilter-only keys
// ═══════════════════════════════════════════════════════════════════════════

describe('cross-filter isolation', () => {
  it('newHouse rejects oldHouse-only keys (minPrice, rooms, keyword)', () => {
    const result = validateNewHouseFilter({
      page: 1,
      pageSize: 10,
      minPrice: 100,
      rooms: 3,
      keyword: 'test',
    });
    // Each unknown key should be caught
    expect(result.ok).toBe(false);
  });

  it('oldHouse rejects newHouse-only keys (status, projectName)', () => {
    const result = validateOldHouseFilter({
      page: 1,
      pageSize: 10,
      status: 'available',
      projectName: 'test',
    });
    expect(result.ok).toBe(false);
  });
});
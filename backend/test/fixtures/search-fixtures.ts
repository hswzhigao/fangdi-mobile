/**
 * Sanitized fixtures for search validation and normalizer tests.
 *
 * These are HAND-CRAFTED examples based on the documented API contract.
 * They contain NO real cookies, tokens, CAPTCHA text, or personally
 * identifiable information.
 *
 * Blocked fixtures represent the UPSTREAM_BLOCKED state — WAF challenges
 * prevent verification of actual search endpoints.
 */

import type { NewHouseFilter, OldHouseFilter } from '../../src/upstream/types';

// ── New house filter: valid ──────────────────────────────────────────────────

/** Minimal valid new-house filter — only required fields. */
export const VALID_NEW_HOUSE_FILTER_MINIMAL: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
};

/** Full valid new-house filter with all optional fields. */
export const VALID_NEW_HOUSE_FILTER_FULL: Record<string, unknown> = {
  district: '浦东新区',
  propertyType: 'residential',
  status: 'available',
  minArea: 50,
  maxArea: 200,
  projectName: '金桥瑞仕',
  page: 1,
  pageSize: 20,
};

/** Valid new-house filter with captcha session and text. */
export const VALID_NEW_HOUSE_FILTER_CAPTCHA: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  captchaSession: 'abc123-validSessionId_2024',
  captchaText: 'A1b2C3',
};

// ── New house filter: invalid ────────────────────────────────────────────────

/** Unknown key in filter body. */
export const INVALID_NEW_HOUSE_FILTER_UNKNOWN_KEY: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  unknownField: 'should be rejected',
};

/** Page out of range. */
export const INVALID_NEW_HOUSE_FILTER_PAGE_NEGATIVE: Record<string, unknown> = {
  page: -1,
  pageSize: 10,
};

/** Page out of range (too large). */
export const INVALID_NEW_HOUSE_FILTER_PAGE_TOO_LARGE: Record<string, unknown> = {
  page: 20000,
  pageSize: 10,
};

/** PageSize out of range. */
export const INVALID_NEW_HOUSE_FILTER_PAGE_SIZE_TOO_LARGE: Record<string, unknown> = {
  page: 1,
  pageSize: 50,
};

/** Non-integer page. */
export const INVALID_NEW_HOUSE_FILTER_PAGE_FLOAT: Record<string, unknown> = {
  page: 1.5,
  pageSize: 10,
};

/** Missing page. */
export const INVALID_NEW_HOUSE_FILTER_NO_PAGE: Record<string, unknown> = {
  pageSize: 10,
};

/** Missing pageSize. */
export const INVALID_NEW_HOUSE_FILTER_NO_PAGE_SIZE: Record<string, unknown> = {
  page: 1,
};

/** Invalid propertyType enum. */
export const INVALID_NEW_HOUSE_FILTER_BAD_PROPERTY_TYPE: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  propertyType: 'villa',
};

/** Invalid status enum. */
export const INVALID_NEW_HOUSE_FILTER_BAD_STATUS: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  status: 'rented',
};

/** minArea > maxArea. */
export const INVALID_NEW_HOUSE_FILTER_AREA_REVERSED: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  minArea: 200,
  maxArea: 50,
};

/** minArea too large. */
export const INVALID_NEW_HOUSE_FILTER_AREA_TOO_LARGE: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  minArea: 2000000,
};

/** maxArea too large. */
export const INVALID_NEW_HOUSE_FILTER_MAX_AREA_TOO_LARGE: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  maxArea: 2000000,
};

/** Captcha text invalid format (contains special chars). */
export const INVALID_NEW_HOUSE_FILTER_BAD_CAPTCHA_TEXT: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  captchaSession: 'abc123-validId-00001',
  captchaText: '!@#$%^',
};

/** Captcha session invalid format. */
export const INVALID_NEW_HOUSE_FILTER_BAD_CAPTCHA_SESSION: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  captchaSession: 'bad/session/id',
  captchaText: 'Abc123',
};

/** projectName with HTML. */
export const INVALID_NEW_HOUSE_FILTER_HTML_PROJECT_NAME: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  projectName: '<script>alert("xss")</script>',
};

/** district with control chars. */
export const INVALID_NEW_HOUSE_FILTER_CONTROL_DISTRICT: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  district: '测试\x00控制',
};

/** pageSize = 0. */
export const INVALID_NEW_HOUSE_FILTER_PAGE_SIZE_ZERO: Record<string, unknown> = {
  page: 1,
  pageSize: 0,
};

/** negative area. */
export const INVALID_NEW_HOUSE_FILTER_NEGATIVE_AREA: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  minArea: -1,
};

// ── Old house filter: valid ──────────────────────────────────────────────────

/** Minimal valid old-house filter. */
export const VALID_OLD_HOUSE_FILTER_MINIMAL: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
};

/** Full valid old-house filter. */
export const VALID_OLD_HOUSE_FILTER_FULL: Record<string, unknown> = {
  district: '徐汇区',
  minArea: 60,
  maxArea: 120,
  minPrice: 1000000,
  maxPrice: 5000000,
  rooms: 3,
  propertyType: 'residential',
  keyword: '地铁',
  page: 1,
  pageSize: 20,
};

// ── Old house filter: invalid ────────────────────────────────────────────────

/** Unknown key. */
export const INVALID_OLD_HOUSE_FILTER_UNKNOWN_KEY: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  randomField: 'nope',
};

/** minPrice > maxPrice. */
export const INVALID_OLD_HOUSE_FILTER_PRICE_REVERSED: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  minPrice: 5000000,
  maxPrice: 1000000,
};

/** Rooms not an integer. */
export const INVALID_OLD_HOUSE_FILTER_ROOMS_FLOAT: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  rooms: 2.5,
};

/** Rooms out of range. */
export const INVALID_OLD_HOUSE_FILTER_ROOMS_TOO_LARGE: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  rooms: 100,
};

/** Price too large. */
export const INVALID_OLD_HOUSE_FILTER_PRICE_TOO_LARGE: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  maxPrice: 2000000000,
};

/** Keyword with HTML. */
export const INVALID_OLD_HOUSE_FILTER_HTML_KEYWORD: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  keyword: '<b>bold</b>',
};

// ── Detail ID fixtures ───────────────────────────────────────────────────────

export const VALID_DETAIL_IDS = [
  'proj-001',
  'house_123',
  'ABC_DEF_456',
  'a'.repeat(80),
];

export const INVALID_DETAIL_IDS = [
  '',
  '../etc/passwd',
  'a/b',
  'a b',
  '<script>',
  'a'.repeat(81),
  'a.b',
];

// ── Market summary fixtures ──────────────────────────────────────────────────

/** Valid yesterday sell data (from verified endpoint /oldhouse/getSHYesterdaySell.action). */
export const VALID_MARKET_SUMMARY_RESPONSE = {
  sellcount: 256,
  sellArea: 22000.5,
  totalAmount: 1200000000,
  averagePrice: 54545,
  date: '2026-07-22',
};

/** Valid with alternate field names (case variants only). */
export const VALID_MARKET_SUMMARY_ALTERNATE = {
  sellCount: 180,
  sellarea: 15000,
  totalamount: 800000000,
  avgPrice: 53333,
  asOf: '2026-07-22',
};

/** Unrelated generic keys not in the verified field set — must yield empty/no-data. */
export const UNRELATED_GENERIC_MARKET_SUMMARY = {
  count: 100,
  area: 5000,
  amount: 200000,
  avgprice: 40000,
  timestamp: '2026-07-22',
};

/** Empty market summary (no valid fields). */
export const EMPTY_MARKET_SUMMARY_RESPONSE = {
  message: 'no data',
  success: false,
};

/** Malformed market summary — wrong types. */
export const MALFORMED_MARKET_SUMMARY = {
  sellcount: 'not a number',
  sellArea: null,
  totalAmount: 'also not a number',
};

// ── UPSTREAM_BLOCKED fixtures ────────────────────────────────────────────────

/** UPSTREAM_BLOCKED error code constant for tests. */
export const BLOCKED_CODE = 'UPSTREAM_BLOCKED' as const;
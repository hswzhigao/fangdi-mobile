/**
 * Old-house (second-hand) search adapter — fixed routes for listing and detail,
 * plus verified market-summary from yesterday's sell endpoint.
 *
 * UPSTREAM_BLOCKED for search/detail: The old-house search endpoints on
 * fangdi.com.cn are protected by Ruishu WAF (412 challenge). All tested
 * endpoints return 412. No verified request format or response schema is
 * available. The adapter returns UPSTREAM_BLOCKED with a documented fallback URL.
 *
 * VERIFIED for market-summary: The `/oldhouse/getSHYesterdaySell.action`
 * endpoint is confirmed working. It returns sellCount, sellArea, totalAmount
 * and averagePrice fields.
 *
 * Adheres strictly to:
 *   - docs/fangdi-mobile/api-contract.md
 *   - docs/fangdi-mobile/architecture.md
 *   - docs/fangdi-mobile/data-policy.md
 */

import type { OldHouseFilter, MarketSummary } from './types';
import {
  UPSTREAM_BASE,
  FALLBACK_URLS,
  fetchUpstreamJson,
  toErrorResponse,
  toSuccessResponse,
  isUpstreamError,
} from './fetch';
import {
  safeNumber,
  safeString,
  requireObject,
  isNormalizerError,
} from './normalizers';
import { jsonError } from '../http/envelope';
import { withCache, buildCacheKey } from '../cache/cache';

// ── Fixed route identifiers ──────────────────────────────────────────────────

const SEARCH_ROUTE = '/api/old-house/search';
const DETAIL_ROUTE = '/api/old-house/detail';
const MARKET_SUMMARY_ROUTE = '/api/old-house/market-summary';
const MARKET_SUMMARY_CACHE_KEY = buildCacheKey(MARKET_SUMMARY_ROUTE);

const YESTERDAY_SELL_URL = `${UPSTREAM_BASE}/oldhouse/getSHYesterdaySell.action`;

// ── UPSTREAM_BLOCKED: search/detail endpoints not verified ───────────────────
//
// The exact upstream old-house search endpoints have not been confirmed.
// The old-house page (https://www.fangdi.com.cn/old_house/old_house.html)
// returns 412 with Ruishu WAF challenge. Without bypassing the WAF,
// we cannot determine the actual AJAX endpoint, request format, or response
// schema. All internal fetch attempts result in UPSTREAM_BLOCKED.
//
// Evidence (2026-07-23):
//   - GET https://www.fangdi.com.cn/old_house/old_house.html → 412 (Ruishu)
//   - POST https://www.fangdi.com.cn/oldhouse/search.action → 412
//   - The market-summary endpoint (/oldhouse/getSHYesterdaySell.action) IS verified
//
// When search/detail endpoints are verified, replace this section.

/**
 * List old houses matching the filter. Currently returns UPSTREAM_BLOCKED
 * because the upstream search endpoint cannot be verified without bypassing WAF.
 */
export async function listOldHouses(
  filter: OldHouseFilter,
  env: EnvLike,
): Promise<Response> {
  return jsonError(
    'UPSTREAM_BLOCKED',
    '二手房搜索接口暂不可用，原站正在进行访问验证，移动版无法代替验证',
    FALLBACK_URLS[SEARCH_ROUTE],
  );
}

/**
 * Get an old house detail by ID. Currently returns UPSTREAM_BLOCKED
 * because the upstream detail endpoint cannot be verified without bypassing WAF.
 */
export async function getOldHouseDetail(
  id: string,
  env: EnvLike,
): Promise<Response> {
  return jsonError(
    'UPSTREAM_BLOCKED',
    '二手房详情接口暂不可用，原站正在进行访问验证，移动版无法代替验证',
    FALLBACK_URLS[DETAIL_ROUTE],
  );
}

// ── Market summary (verified) ────────────────────────────────────────────────

/**
 * Normalize a raw upstream object into a MarketSummary.
 * Only maps known fields from the verified /oldhouse/getSHYesterdaySell.action
 * response. Returns null if no valid fields are extracted.
 */
function normalizeMarketSummary(raw: unknown): MarketSummary | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const result: MarketSummary = {};

  const asOf = safeString(r.asOf ?? r.date ?? r.statDate);
  if (asOf) result.asOf = asOf;

  const sellCount = safeNumber(r.sellcount ?? r.sellCount);
  if (sellCount !== undefined) result.sellCount = sellCount;

  const sellArea = safeNumber(r.sellArea ?? r.sellarea);
  if (sellArea !== undefined) result.sellArea = sellArea;

  const totalAmount = safeNumber(r.totalAmount ?? r.totalamount);
  if (totalAmount !== undefined) result.totalAmount = totalAmount;

  const avgPrice = safeNumber(r.averagePrice ?? r.avgPrice);
  if (avgPrice !== undefined) result.averagePrice = avgPrice;

  if (Object.keys(result).length === 0) return null;
  return result;
}

/**
 * Export for testing only — verifies that only documented field names are accepted.
 */
export { normalizeMarketSummary };

/**
 * Fetch the verified old-house market summary (yesterday's sell data).
 *
 * Endpoint: POST https://www.fangdi.com.cn/oldhouse/getSHYesterdaySell.action
 * Cached for 5 minutes (same as /api/trade).
 */
export async function getOldHouseMarketSummary(request: Request): Promise<Response> {
  return withCache(MARKET_SUMMARY_ROUTE, MARKET_SUMMARY_CACHE_KEY, async () => {
    const parsed = await fetchUpstreamJson(
      YESTERDAY_SELL_URL,
      MARKET_SUMMARY_ROUTE,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': UPSTREAM_BASE,
          'Referer': `${UPSTREAM_BASE}/old_house/old_house.html`,
        },
        body: '',
      },
    );

    if (isUpstreamError(parsed)) {
      return toErrorResponse(parsed, request);
    }

    const obj = requireObject(parsed);
    if (isNormalizerError(obj)) {
      // Return with market-summary fallback
      return toErrorResponse(
        {
          code: obj.code,
          message: obj.message,
          retryable: obj.retryable,
          fallbackUrl: FALLBACK_URLS[MARKET_SUMMARY_ROUTE],
        },
        request,
      );
    }

    const data = normalizeMarketSummary(obj);
    if (!data) {
      return jsonError(
        'UPSTREAM_SCHEMA',
        '二手房成交数据格式暂不可识别，请访问原站查看',
        FALLBACK_URLS[MARKET_SUMMARY_ROUTE],
        request,
      );
    }

    return toSuccessResponse(data, false, request);
  });
}

// ── Minimal env type ─────────────────────────────────────────────────────────

export interface EnvLike {
  DB?: D1Database;
  CAPTCHA_SALT?: string;
}
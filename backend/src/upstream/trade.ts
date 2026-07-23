/**
 * Trade adapter — current snapshot of trade statistics.
 *
 * Fetches yesterday's sell data from the fixed endpoint. Only maps validated
 * numeric metrics; historical trend fields are omitted. Sets a limitation note
 * when trend data is not verified.
 *
 * Endpoint: /oldhouse/getSHYesterdaySell.action
 */

import type { TradeData, TradeMetric } from './types';
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
import { withCache, buildCacheKey, CACHE_TTL } from '../cache/cache';

// ── Constants ────────────────────────────────────────────────────────────────

const ROUTE = '/api/trade';
const CACHE_KEY = buildCacheKey(ROUTE);
const YESTERDAY_SELL_URL = `${UPSTREAM_BASE}/oldhouse/getSHYesterdaySell.action`;

// ── Normalizer ───────────────────────────────────────────────────────────────

function normalizeTradeMetric(raw: unknown): TradeMetric | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const metric: TradeMetric = {};
  const count = safeNumber(r.count ?? r.sellcount ?? r.sellCount ?? r.num);
  if (count !== undefined) metric.count = count;
  const area = safeNumber(r.area ?? r.sellArea);
  if (area !== undefined) metric.area = area;
  const amount = safeNumber(r.amount ?? r.totalAmount);
  if (amount !== undefined) metric.amount = amount;
  const avgPrice = safeNumber(r.averagePrice ?? r.avgPrice);
  if (avgPrice !== undefined) metric.averagePrice = avgPrice;
  if (Object.keys(metric).length === 0) return null;
  return metric;
}

function normalizeDistrict(
  raw: unknown,
): { name: string; count?: number; area?: number } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = safeString(r.name ?? r.district ?? r.area);
  if (!name) return null;
  return {
    name,
    count: safeNumber(r.count ?? r.num),
    area: safeNumber(r.area),
  };
}

// ── Public handler ───────────────────────────────────────────────────────────

export async function getTrade(request: Request): Promise<Response> {
  return withCache(ROUTE, CACHE_KEY, async () => {
    const parsed = await fetchUpstreamJson(YESTERDAY_SELL_URL, ROUTE);

    if (isUpstreamError(parsed)) {
      return toErrorResponse(parsed, request);
    }

    const obj = requireObject(parsed);
    if (isNormalizerError(obj)) {
      return toErrorResponse(obj, request);
    }

    const r = obj as Record<string, unknown>;

    const data: TradeData = {};

    const asOf = safeString(r.asOf ?? r.date ?? r.updateTime ?? r.statDate);
    if (asOf) data.asOf = asOf;

    const newHouseRaw = r.newHouse ?? r.new ?? r.xf ?? r;
    const newHouse = normalizeTradeMetric(newHouseRaw);
    if (newHouse) data.newHouse = newHouse;

    const oldHouseRaw = r.oldHouse ?? r.old ?? r.esf ?? r;
    const oldHouse = normalizeTradeMetric(oldHouseRaw);
    if (oldHouse) data.oldHouse = oldHouse;

    const byDistrictRaw = r.byDistrict ?? r.districts ?? r.areaList ?? r.list;
    if (Array.isArray(byDistrictRaw)) {
      const districts = byDistrictRaw
        .map(normalizeDistrict)
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .slice(0, 20);
      if (districts.length > 0) data.byDistrict = districts;
    }

    data.note = '当前仅展示已验证的交易快照数据；历史趋势和完整统计请访问原站。';

    if (!data.asOf && !data.newHouse && !data.oldHouse && !data.byDistrict) {
      return toErrorResponse(
        {
          code: 'UPSTREAM_SCHEMA',
          message: '交易数据格式暂不可识别，请访问原站查看',
          retryable: false,
          fallbackUrl: FALLBACK_URLS[ROUTE],
        },
        request,
      );
    }

    return toSuccessResponse(data, false, request);
  });
}

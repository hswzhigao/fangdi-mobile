/**
 * Home page adapter — aggregates multiple fixed upstream endpoints.
 *
 * Per-module failure isolation: if one module fails, the rest still return data.
 * If ALL modules fail, returns a prioritized documented error (UPSTREAM_BLOCKED,
 * UPSTREAM_TIMEOUT, UPSTREAM_BAD_STATUS, or UPSTREAM_SCHEMA) with the correct
 * fallback URL. Never invents empty data when the upstream is unavailable.
 */

import type { Notice, HouseSummary, SellUpcoming, BargainSummary, HomeData } from './types';
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
  safeText,
  safeId,
  safeDateString,
  requireArray,
  requireObject,
  isNormalizerError,
  normalizeNotice,
} from './normalizers';
import type { NormalizerError } from './normalizers';
import { withCache, buildCacheKey } from '../cache/cache';

// ── Fixed endpoint URLs ──────────────────────────────────────────────────────

const ROUTE = '/api/home';
const CACHE_KEY = buildCacheKey(ROUTE);

function ep(path: string): string {
  return `${UPSTREAM_BASE}${path}`;
}

// ── Module result tracking ────────────────────────────────────────────────────

/** Tracked per-module error shape — compatible with toErrorResponse. */
interface ModuleError {
  code: string;
  message: string;
  retryable: boolean;
  fallbackUrl?: string;
}

/** Result of a single module fetch — either data or an error. */
type ModuleResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: ModuleError };

/**
 * Fetch one upstream URL and normalize its response into a typed list.
 * Preserves the original error code for accurate error reporting when all modules fail.
 */
async function fetchModule<T>(
  url: string,
  normalizer: (raw: unknown) => T | null,
): Promise<ModuleResult<T>> {
  const parsed = await fetchUpstreamJson(url, ROUTE);
  if (isUpstreamError(parsed)) {
    return { ok: false, error: parsed as ModuleError };
  }
  const obj = requireObject(parsed);
  if (isNormalizerError(obj)) return { ok: false, error: obj };
  const list = requireArray(
    (obj as Record<string, unknown>).list ??
    (obj as Record<string, unknown>).data ??
    obj,
  );
  if (isNormalizerError(list)) return { ok: false, error: list };
  const items = list
    .slice(0, 10)
    .map(normalizer)
    .filter((n): n is T => n !== null);
  return { ok: true, data: items };
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeHouseSummary(raw: unknown): HouseSummary | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id ?? r.ID ?? r.houseId ?? r.projectId);
  const name = safeText(r.name ?? r.projectName ?? r.houseName, 100);
  if (!id || !name) return null;
  return {
    id,
    name,
    district: safeText(r.district ?? r.area, 50),
    status: safeText(r.status, 30),
    area: safeNumber(r.area),
    updatedAt: safeDateString(r.updatedAt ?? r.updateTime) ?? undefined,
  };
}

function normalizeSellUpcoming(raw: unknown): SellUpcoming | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id ?? r.ID ?? r.projectId);
  const name = safeText(r.name ?? r.projectName, 100);
  if (!id || !name) return null;
  return {
    id,
    name,
    district: safeText(r.district ?? r.area, 50),
    plannedDate: safeDateString(r.plannedDate ?? r.sellDate) ?? undefined,
  };
}

function normalizeBargainSummary(raw: unknown): BargainSummary | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id ?? r.ID ?? r.projectId);
  const name = safeText(r.name ?? r.projectName, 100);
  if (!id || !name) return null;
  return {
    id,
    name,
    district: safeText(r.district ?? r.area, 50),
    count: safeNumber(r.count),
    area: safeNumber(r.area),
  };
}

// ── Error priority — when all modules fail, return the highest-priority error ─

/**
 * Priority order for error codes. Lower index = higher priority.
 * UPSTREAM_BLOCKED (WAF) is most important; UPSTREAM_SCHEMA is least.
 */
const ERROR_PRIORITY: Record<string, number> = {
  'UPSTREAM_BLOCKED': 0,
  'UPSTREAM_TIMEOUT': 1,
  'UPSTREAM_BAD_STATUS': 2,
  'UPSTREAM_SCHEMA': 3,
};

function pickPriorityError(errors: ModuleError[]): ModuleError {
  return errors.reduce((best, cur) => {
    const curPrio = ERROR_PRIORITY[cur.code] ?? 99;
    const bestPrio = ERROR_PRIORITY[best.code] ?? 99;
    return curPrio < bestPrio ? cur : best;
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function getHome(request: Request): Promise<Response> {
  return withCache(ROUTE, CACHE_KEY, async () => {
    // Fetch all modules in parallel — each returns a ModuleResult with error tracking.
    const results = await Promise.all([
      fetchModule(ep('/service/index/getIndexMessage.action'), normalizeNotice),
      fetchModule(ep('/service/index/getProclamation.action'), normalizeNotice),
      fetchModule(ep('/service/index/getRecentHouse.action'), normalizeHouseSummary),
      fetchModule(ep('/service/index/getSellUpcoming.action'), normalizeSellUpcoming),
      fetchModule(ep('/service/index/getNewPremises.action'), normalizeHouseSummary),
      fetchModule(ep('/service/index/getHosueBargain.action'), normalizeBargainSummary),
      fetchModule(ep('/service/index/getSecondHouse.action'), normalizeHouseSummary),
      fetchModule(ep('/service/index/getHousePolicies.action'), normalizeNotice),
      fetchModule(ep('/service/index/getHouseNews.action'), normalizeNotice),
    ]);

    const [
      noticesRes,
      proclamationsRes,
      recentHousesRes,
      sellUpcomingRes,
      newPremisesRes,
      houseBargainRes,
      secondHouseRes,
      policiesRes,
      newsRes,
    ] = results;

    // Extract data.
    const notices = noticesRes.ok ? noticesRes.data : [];
    const proclamations = proclamationsRes.ok ? proclamationsRes.data : [];
    const recentHouses = recentHousesRes.ok ? recentHousesRes.data : [];
    const sellUpcoming = sellUpcomingRes.ok ? sellUpcomingRes.data : [];
    const newPremises = newPremisesRes.ok ? newPremisesRes.data : [];
    const houseBargain = houseBargainRes.ok ? houseBargainRes.data : [];
    const secondHouse = secondHouseRes.ok ? secondHouseRes.data : [];
    const policies = policiesRes.ok ? policiesRes.data : [];
    const news = newsRes.ok ? newsRes.data : [];

    // Collect errors from all failed modules.
    const errors: ModuleError[] = [];
    for (const r of results) {
      if (!r.ok) errors.push(r.error);
    }

    // If ALL modules returned empty, return prioritized error instead of fake data.
    const allEmpty =
      notices.length === 0 &&
      proclamations.length === 0 &&
      recentHouses.length === 0 &&
      sellUpcoming.length === 0 &&
      newPremises.length === 0 &&
      houseBargain.length === 0 &&
      secondHouse.length === 0 &&
      policies.length === 0 &&
      news.length === 0;

    if (allEmpty) {
      if (errors.length > 0) {
        const best = pickPriorityError(errors);
        // Cast through NormalizerError — toErrorResponse accepts both types.
        return toErrorResponse(best as NormalizerError, request);
      }
      // Safety net: no tracked errors but all empty → treat as blocked.
      return toErrorResponse(
        {
          code: 'UPSTREAM_BLOCKED',
          message: '原站正在进行访问验证，移动版无法代替验证',
          retryable: true,
          fallbackUrl: FALLBACK_URLS[ROUTE],
        } as NormalizerError,
        request,
      );
    }

    // Merge proclamations into notices (both are Notice[]).
    const mergedNotices = [...notices, ...proclamations].slice(0, 20);

    const data: HomeData = {
      notices: mergedNotices,
      recentHouses,
      sellUpcoming,
      newPremises,
      houseBargain,
      secondHouse,
      policies,
      news,
    };

    return toSuccessResponse(data, false, request);
  });
}

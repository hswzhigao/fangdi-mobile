/**
 * Notices adapter — proclamation/policy/news with kind allowlist, pagination,
 * and fixed detail URL construction from validated IDs.
 *
 * Never accepts arbitrary URLs or query parameters beyond kind/page/pageSize.
 * Detail URLs are constructed from validated opaque IDs only.
 */

import type { Notice, Page, NoticeKind } from './types';
import { NOTICE_KINDS } from './types';
import {
  UPSTREAM_BASE,
  fetchUpstreamJson,
  toErrorResponse,
  toSuccessResponse,
  isUpstreamError,
} from './fetch';
import {
  requireArray,
  requireObject,
  isNormalizerError,
  normalizeNotice,
} from './normalizers';
import { withCache, buildCacheKey, CACHE_TTL } from '../cache/cache';
import { jsonError } from '../http/envelope';
import { validateQueryKeys } from '../http/validation';

// ── Fixed endpoint URLs by kind ──────────────────────────────────────────────

const ROUTE = '/api/notices';

const KIND_ENDPOINTS: Record<NoticeKind, string> = {
  proclamation: `${UPSTREAM_BASE}/service/index/getProclamation.action`,
  policy: `${UPSTREAM_BASE}/service/index/getHousePolicies.action`,
  news: `${UPSTREAM_BASE}/service/index/getHouseNews.action`,
};

// ── Validation ───────────────────────────────────────────────────────────────

const ALLOWED_QUERY_KEYS = ['kind', 'page', 'pageSize'];

function parseNoticeParams(url: URL):
  | { ok: true; kind: NoticeKind; page: number; pageSize: number }
  | { ok: false; error: string }
{
  const keyErr = validateQueryKeys(url.searchParams, ALLOWED_QUERY_KEYS);
  if (keyErr) return { ok: false, error: keyErr };

  const kindRaw = url.searchParams.get('kind');
  if (!kindRaw || !NOTICE_KINDS.includes(kindRaw as NoticeKind)) {
    return { ok: false, error: `kind 参数无效，允许: ${NOTICE_KINDS.join(', ')}` };
  }
  const kind = kindRaw as NoticeKind;

  const pageRaw = url.searchParams.get('page');
  const pageSizeRaw = url.searchParams.get('pageSize');

  const page = Number(pageRaw);
  const pageSize = Number(pageSizeRaw);

  if (!pageRaw || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
    return { ok: false, error: 'page 参数必须在 1-10000 之间，且为整数' };
  }
  if (!pageSizeRaw || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 20) {
    return { ok: false, error: 'pageSize 参数必须在 1-20 之间，且为整数' };
  }

  return { ok: true, kind, page, pageSize };
}

// ── Public handler ───────────────────────────────────────────────────────────

export async function getNotices(
  url: URL,
  request: Request,
): Promise<Response> {
  // Parse and validate params.
  const pp = parseNoticeParams(url);
  if (!pp.ok) {
    return jsonError('BAD_REQUEST', pp.error, undefined, request);
  }
  const { kind, page, pageSize } = pp;

  // Build cache key (includes kind/page/pageSize for distinct cache entries).
  const cacheKey = buildCacheKey(ROUTE, `${kind}:${page}:${pageSize}`);

  return withCache(ROUTE, cacheKey, async () => {
    // Fetch from upstream.
    const endpoint = KIND_ENDPOINTS[kind];
    const parsed = await fetchUpstreamJson(endpoint, ROUTE);

    if (isUpstreamError(parsed)) {
      return toErrorResponse(parsed, request);
    }

    const obj = requireObject(parsed);
    if (isNormalizerError(obj)) {
      return toErrorResponse(obj, request);
    }

    const list = requireArray((obj as Record<string, unknown>).list ?? (obj as Record<string, unknown>).data ?? obj);
    if (isNormalizerError(list)) {
      return toErrorResponse(list, request);
    }

    // Normalize each notice.
    const items = list
      .map(normalizeNotice)
      .filter((n): n is Notice => n !== null);

    // Paginate in memory (upstream may not support pagination).
    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    const hasMore = start + pageSize < total;

    const data: Page<Notice> = {
      items: paged,
      page,
      pageSize,
      total,
      hasMore,
    };

    return toSuccessResponse(data, false, request);
  });
}

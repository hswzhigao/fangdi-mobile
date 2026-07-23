/**
 * New-house search adapter — fixed routes for listing and detail.
 *
 * UPSTREAM_BLOCKED: The new-house search endpoints on fangdi.com.cn are
 * protected by Ruishu WAF (412 challenge). All tested endpoints return 412.
 * No verified request format or response schema is available. The adapter
 * returns UPSTREAM_BLOCKED with a documented fallback URL.
 *
 * When a verified endpoint is confirmed (via authorized browser inspection
 * without WAF bypass), the adapter will be updated to include the actual
 * fixed fetch + normalizer.
 *
 * Adheres strictly to:
 *   - docs/fangdi-mobile/api-contract.md (POST /api/new-house/search, GET /api/new-house/:id)
 *   - docs/fangdi-mobile/architecture.md (fixed upstream strategy)
 *   - docs/fangdi-mobile/data-policy.md (no-cache, no body logging)
 */

import type { NewHouseFilter } from './types';
import {
  FALLBACK_URLS,
} from './fetch';
import { jsonError } from '../http/envelope';

// ── Fixed route identifiers ──────────────────────────────────────────────────

const SEARCH_ROUTE = '/api/new-house/search';
const DETAIL_ROUTE = '/api/new-house/detail';

// ── UPSTREAM_BLOCKED: endpoints not verified ─────────────────────────────────
//
// The exact upstream new-house search endpoint has not been confirmed.
// The new-house page (https://www.fangdi.com.cn/new_house/new_house.html)
// returns 412 with Ruishu WAF challenge. Without bypassing the WAF,
// we cannot determine the actual AJAX endpoint, request format, or response
// schema. All internal fetch attempts result in UPSTREAM_BLOCKED.
//
// Evidence (2026-07-23):
//   - GET https://www.fangdi.com.cn/new_house/new_house.html → 412 (Ruishu)
//   - POST https://www.fangdi.com.cn/newhouse/getNewHouseList.action → 412
//   - POST https://www.fangdi.com.cn/service/newHouse/search.action → 412
//
// When the endpoint is verified, replace this section with the actual
// fixed URL and normalizer.

/**
 * List new houses matching the filter. Currently returns UPSTREAM_BLOCKED
 * because the upstream search endpoint cannot be verified without bypassing WAF.
 */
export async function listNewHouses(
  filter: NewHouseFilter,
  env: EnvLike,
): Promise<Response> {
  // The upstream search endpoint is behind WAF and unverified.
  // Return a documented block error rather than attempting unknown URLs.
  return jsonError(
    'UPSTREAM_BLOCKED',
    '新房搜索接口暂不可用，原站正在进行访问验证，移动版无法代替验证',
    FALLBACK_URLS[SEARCH_ROUTE],
  );
}

/**
 * Get a new house detail by ID. Currently returns UPSTREAM_BLOCKED
 * because the upstream detail endpoint cannot be verified without bypassing WAF.
 */
export async function getNewHouseDetail(
  id: string,
  env: EnvLike,
): Promise<Response> {
  return jsonError(
    'UPSTREAM_BLOCKED',
    '新房详情接口暂不可用，原站正在进行访问验证，移动版无法代替验证',
    FALLBACK_URLS[DETAIL_ROUTE],
  );
}

// ── Minimal env type ─────────────────────────────────────────────────────────

export interface EnvLike {
  DB?: D1Database;
  CAPTCHA_SALT?: string;
}
/**
 * API types — mirror backend stable types from api-contract.md.
 * Keep `unknown` at the network boundary; validate envelope shape before use.
 */

// ── ApiError codes ────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'CAPTCHA_REQUIRED'
  | 'CAPTCHA_EXPIRED'
  | 'CAPTCHA_INVALID'
  | 'UPSTREAM_BLOCKED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_BAD_STATUS'
  | 'UPSTREAM_SCHEMA'
  | 'INTERNAL_ERROR';

// ── Envelope ──────────────────────────────────────────────────────────────────

export type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
      meta?: { source: 'upstream' | 'fallback'; cached: boolean; fetchedAt: string };
    }
  | {
      ok: false;
      error: {
        code: ApiErrorCode;
        message: string;
        retryable: boolean;
        fallbackUrl?: string;
      };
    };

// ── ApiError (extracted from failed envelope) ──────────────────────────────────

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  fallbackUrl?: string;
}

// ── ApiMeta (success envelope meta) ───────────────────────────────────────────

export interface ApiMeta {
  source: 'upstream' | 'fallback';
  cached: boolean;
  fetchedAt: string;
}

// ── ApiResult (typed return from apiGet/apiPost) ─────────────────────────────

export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

// ── Application state ────────────────────────────────────────────────────────

export type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T; meta?: ApiMeta }
  | { status: 'empty' }
  | { status: 'error'; error: ApiError };

// ── Page wrapper ──────────────────────────────────────────────────────────────

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total?: number;
  hasMore: boolean;
};

// ── Notice ────────────────────────────────────────────────────────────────────

export interface Notice {
  id: string;
  title: string;
  publishedAt?: string;
  category?: string;
  summary?: string;
  detailUrl?: string;
}

// ── House summary ─────────────────────────────────────────────────────────────

export interface HouseSummary {
  id: string;
  name: string;
  district?: string;
  status?: string;
  area?: number;
  updatedAt?: string;
}

// ── Sell upcoming ─────────────────────────────────────────────────────────────

export interface SellUpcoming {
  id: string;
  name: string;
  district?: string;
  plannedDate?: string;
}

// ── Bargain summary ───────────────────────────────────────────────────────────

export interface BargainSummary {
  id: string;
  name: string;
  district?: string;
  count?: number;
  area?: number;
}

// ── Home ──────────────────────────────────────────────────────────────────────

export interface HomeData {
  notices: Notice[];
  recentHouses: HouseSummary[];
  sellUpcoming: SellUpcoming[];
  newPremises: HouseSummary[];
  houseBargain: BargainSummary[];
  secondHouse: HouseSummary[];
  policies: Notice[];
  news: Notice[];
}

// ── Trade ─────────────────────────────────────────────────────────────────────

export interface TradeMetric {
  count?: number;
  area?: number;
  amount?: number;
  averagePrice?: number;
}

export interface TradeData {
  asOf?: string;
  newHouse?: TradeMetric;
  oldHouse?: TradeMetric;
  byDistrict?: Array<{ name: string; count?: number; area?: number }>;
  note?: string;
}

// ── Lease ─────────────────────────────────────────────────────────────────────

export interface LeaseData {
  faqs: Array<{ id: string; question: string; answer: string }>;
  downloads: Array<{ title: string; url: string; format?: string }>;
  links: Array<{ title: string; url: string }>;
  limitation: string;
}

// ── House detail ──────────────────────────────────────────────────────────────

export interface HouseDetail {
  id: string;
  name: string;
  district?: string;
  address?: string;
  status?: string;
  area?: number;
  rooms?: number;
  updatedAt?: string;
  detailUrl?: string;
}

// ── Fixed fallback URLs (original site) ───────────────────────────────────────

export const FALLBACK_URLS: Record<string, string> = {
  home: 'https://www.fangdi.com.cn/',
  newHouse: 'https://www.fangdi.com.cn/new_house/new_house.html',
  oldHouse: 'https://www.fangdi.com.cn/old_house/old_house.html',
  lease: 'https://www.fangdi.com.cn/lease/lease.html',
  trade: 'https://www.fangdi.com.cn/trade/trade.html',
};

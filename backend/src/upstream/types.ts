/**
 * Public content contract types — must match docs/fangdi-mobile/api-contract.md exactly.
 * Never extend with guessed fields; unknown upstream fields are dropped.
 */

// ── Page wrapper ─────────────────────────────────────────────────────────────

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total?: number;
  hasMore: boolean;
};

// ── Home ─────────────────────────────────────────────────────────────────────

export type Notice = {
  id: string;
  title: string;
  publishedAt?: string;
  category?: string;
  summary?: string;
  detailUrl?: string;
};

export type HouseSummary = {
  id: string;
  name: string;
  district?: string;
  status?: string;
  area?: number;
  updatedAt?: string;
};

export type SellUpcoming = {
  id: string;
  name: string;
  district?: string;
  plannedDate?: string;
};

export type BargainSummary = {
  id: string;
  name: string;
  district?: string;
  count?: number;
  area?: number;
};

export type HomeData = {
  notices: Notice[];
  recentHouses: HouseSummary[];
  sellUpcoming: SellUpcoming[];
  newPremises: HouseSummary[];
  houseBargain: BargainSummary[];
  secondHouse: HouseSummary[];
  policies: Notice[];
  news: Notice[];
};

// ── Trade ────────────────────────────────────────────────────────────────────

export type TradeMetric = {
  count?: number;
  area?: number;
  amount?: number;
  averagePrice?: number;
};

export type TradeData = {
  asOf?: string;
  newHouse?: TradeMetric;
  oldHouse?: TradeMetric;
  byDistrict?: Array<{ name: string; count?: number; area?: number }>;
  note?: string;
};

// ── Lease ────────────────────────────────────────────────────────────────────

export type LeaseData = {
  faqs: Array<{ id: string; question: string; answer: string }>;
  downloads: Array<{ title: string; url: string; format?: string }>;
  links: Array<{ title: string; url: string }>;
  limitation: string;
};

// ── Notice kind allowlist ────────────────────────────────────────────────────

export const NOTICE_KINDS = ['proclamation', 'policy', 'news'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

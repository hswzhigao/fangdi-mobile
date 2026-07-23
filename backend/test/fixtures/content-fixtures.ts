/**
 * Sanitized fixtures for normalizer tests.
 *
 * These are HAND-CRAFTED examples that match the upstream response structure
 * as documented. They contain NO real cookies, tokens, CAPTCHA text, or
 * personally identifiable information.
 *
 * Blocked fixtures represent what the upstream returns when WAF/CAPTCHA
 * challenges are active (412, HTML page). These are used to verify that
 * the normalizer maps them to UPSTREAM_BLOCKED rather than fabricating data.
 */

// ── Home fixtures ────────────────────────────────────────────────────────────

/** A valid notice from the getIndexMessage endpoint. */
export const VALID_NOTICE = {
  noticeId: 'abc-123-def',
  title: '关于2026年第三季度住房保障工作的通知',
  publishDate: '2026-07-01T08:00:00Z',
  category: 'policy',
  summary: '根据市政府统一部署，2026年第三季度住房保障工作将重点推进以下事项…',
};

/** A valid house summary from getRecentHouse. */
export const VALID_HOUSE_SUMMARY = {
  id: 'proj-001',
  name: '金桥瑞仕花园',
  district: '浦东新区',
  status: 'available',
  area: 120.5,
};

/** A valid sell upcoming item. */
export const VALID_SELL_UPCOMING = {
  id: 'sell-001',
  projectName: '龙湖春江天玺',
  district: '闵行区',
  plannedDate: '2026-08-15',
};

/** A valid bargain summary. */
export const VALID_BARGAIN = {
  projectId: 'bg-001',
  projectName: '万科翡翠公园',
  district: '浦东新区',
  count: 15,
  area: 1500.25,
};

/** Malformed notice — missing required id field. */
export const MALFORMED_NOTICE_MISSING_ID = {
  title: 'Some title',
  publishDate: '2026-07-01',
};

/** Malformed notice — title is HTML. */
export const UNSAFE_NOTICE_HTML_TITLE = {
  noticeId: 'unsafe-001',
  title: '<script>alert("xss")</script>Important Notice',
  publishDate: '2026-07-01',
};

/** Overlong title (300+ chars). */
export const OVERLONG_TITLE_NOTICE = {
  noticeId: 'long-001',
  title: 'A'.repeat(500) + '重要通知',
  publishDate: '2026-07-01',
};

/** Empty upstream response — object with no arrays. */
export const EMPTY_HOME_RESPONSE = {
  success: true,
  message: 'no data',
};

// ── Notices fixtures ─────────────────────────────────────────────────────────

/** Valid proclamation list. */
export const VALID_PROCLAMATION_LIST = {
  list: [
    { id: 'proc-001', title: '上海市住房发展十四五规划公告', publishDate: '2026-06-01' },
    { id: 'proc-002', title: '商品房预售许可证公示', publishDate: '2026-06-15' },
  ],
  total: 2,
};

/** Valid policy list. */
export const VALID_POLICY_LIST = {
  data: [
    { id: 'pol-001', title: '关于调整住房公积金政策的通知', publishDate: '2026-05-20' },
    { id: 'pol-002', title: '房地产市场调控实施细则', publishDate: '2026-05-25' },
    { id: 'pol-003', title: '住房租赁管理办法修订', publishDate: '2026-06-01' },
  ],
};

/** Valid news list with HTML in summary that must be stripped. */
export const VALID_NEWS_LIST_WITH_HTML = {
  list: [
    {
      id: 'news-001',
      title: '上海楼市最新动态',
      publishDate: '2026-07-10',
      summary: '<p>6月全市新建商品住宅成交<span>环比增长</span>5.2%</p>',
    },
    {
      id: 'news-002',
      title: '浦东新区土地出让公告',
      publishDate: '2026-07-09',
      summary: '<div class="content">浦东新区近日发布三宗住宅用地出让公告</div>',
    },
  ],
};

// ── Trade fixtures ───────────────────────────────────────────────────────────

/** Valid yesterday sell data (from documented field patterns). */
export const VALID_YESTERDAY_SELL = {
  asOf: '2026-07-22',
  newHouse: {
    count: 128,
    area: 13500.5,
    amount: 850000000,
    averagePrice: 62963,
  },
  oldHouse: {
    sellcount: 256,
    sellArea: 22000.0,
    totalAmount: 1200000000,
  },
  byDistrict: [
    { name: '浦东新区', count: 85, area: 8500 },
    { name: '闵行区', count: 42, area: 3800 },
    { name: '徐汇区', count: 35, area: 2900 },
  ],
};

/** Malformed yesterday sell — wrong types. */
export const MALFORMED_TRADE = {
  asOf: 12345, // not a string
  newHouse: 'not an object',
  oldHouse: null,
};

// ── Blocked/challenge fixtures ───────────────────────────────────────────────

/** HTML challenge page (what upstream returns when WAF is triggered). */
export const CHALLENGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>访问验证</title></head>
<body>
  <div id="challenge">请完成安全验证</div>
</body>
</html>`;

/** HTTP 412 response simulation body. */
export const BLOCKED_412_BODY = '';

// ── Non-JSON fixture ─────────────────────────────────────────────────────────

export const NON_JSON_BODY = 'Service temporarily unavailable';

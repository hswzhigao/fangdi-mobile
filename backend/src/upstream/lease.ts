/**
 * Lease adapter — static FAQ, downloads, and external links.
 *
 * No public rental listing API has been verified. This adapter provides only
 * reviewed static content and fixed source URLs. The `limitation` field clearly
 * states that a public rental listing API is not available.
 *
 * Cached for 1 hour since the content is static.
 */

import type { LeaseData } from './types';
import { toSuccessResponse } from './fetch';
import { withCache, buildCacheKey, CACHE_TTL } from '../cache/cache';

// ── Constants ────────────────────────────────────────────────────────────────

const ROUTE = '/api/lease';
const CACHE_KEY = buildCacheKey(ROUTE);

// ── Static content (reviewed, from authorized public sources) ─────────────────

const STATIC_LEASE_DATA: LeaseData = {
  faqs: [
    {
      id: 'faq-1',
      question: '如何查询上海市住房租赁信息？',
      answer: '上海市住房租赁公共服务平台提供租赁房源核验、合同网签备案等服务。请访问原站获取最新信息。',
    },
    {
      id: 'faq-2',
      question: '租赁合同是否需要备案？',
      answer: '根据上海市相关规定，住房租赁合同应当通过住房租赁公共服务平台办理网签备案。',
    },
    {
      id: 'faq-3',
      question: '如何办理租赁合同网签？',
      answer: '租赁双方可通过上海市住房租赁公共服务平台在线办理租赁合同网签，具体操作指引请访问原站。',
    },
    {
      id: 'faq-4',
      question: '本移动版是否提供租赁房源查询？',
      answer: '移动版暂未接入租赁房源查询API。请通过原站租赁频道或上海市住房租赁公共服务平台查询。',
    },
  ],
  downloads: [
    {
      title: '上海市住房租赁合同示范文本',
      url: 'https://www.fangdi.com.cn/lease/lease.html',
      format: '原站页面',
    },
    {
      title: '租赁合同网签备案操作指南',
      url: 'https://www.fangdi.com.cn/lease/lease.html',
      format: '原站页面',
    },
  ],
  links: [
    {
      title: '上海市住房租赁公共服务平台',
      url: 'https://www.fangdi.com.cn/lease/lease.html',
    },
    {
      title: '网上房地产租赁频道',
      url: 'https://www.fangdi.com.cn/lease/lease.html',
    },
  ],
  limitation: '移动版暂未接入租赁房源查询API，当前仅提供静态租赁信息和外部链接。房源查询请访问原站租赁频道。',
};

// ── Public handler ───────────────────────────────────────────────────────────

export async function getLease(request: Request): Promise<Response> {
  return withCache(ROUTE, CACHE_KEY, async () => {
    return toSuccessResponse(STATIC_LEASE_DATA, false, request);
  });
}

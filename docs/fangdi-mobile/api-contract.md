# API 契约

**状态：设计已确认，schema 适配待真实联调。**

## 通用响应

所有 API 都返回 JSON，不把上游原始响应直接透传给前端。

```ts
export type ApiEnvelope<T> = {
  ok: true;
  data: T;
  meta?: { source: 'upstream' | 'fallback'; cached: boolean; fetchedAt: string };
} | {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
    fallbackUrl?: string;
  };
};
```

成功响应不保证上游实时：`meta.cached` 必须准确；`fetchedAt` 使用 ISO 8601。错误 message 是面向用户的简洁中文，不能包含 URL 查询中的动态 challenge 参数、Cookie、令牌或原始响应体。

## 固定错误码

| code | HTTP | retryable | 前端行为 |
|---|---:|---|---|
| `BAD_REQUEST` | 400 | 否 | 保留表单值，显示字段错误 |
| `NOT_FOUND` | 404 | 否 | 显示页面不存在和原站入口 |
| `METHOD_NOT_ALLOWED` | 405 | 否 | 不重试 |
| `RATE_LIMITED` | 429 | 是 | 显示稍后重试，不自动循环 |
| `CAPTCHA_REQUIRED` | 428 | 否 | 打开验证码弹层 |
| `CAPTCHA_EXPIRED` | 410 | 否 | 清理 session，重新获取验证码 |
| `CAPTCHA_INVALID` | 422 | 否 | 保留查询条件，刷新图片 |
| `UPSTREAM_BLOCKED` | 502 | 是 | 解释 WAF/访问验证失败，固定原站链接 |
| `UPSTREAM_TIMEOUT` | 504 | 是 | 显示超时，提供重试和原站链接 |
| `UPSTREAM_BAD_STATUS` | 502 | 是 | 显示上游暂不可用和原站链接 |
| `UPSTREAM_SCHEMA` | 502 | 否 | 显示数据格式暂不可识别，不展示猜测数据 |
| `INTERNAL_ERROR` | 500 | 是 | 通用失败提示，不暴露异常细节 |

## 路由清单

所有路径都是精确白名单；path/query 中不允许携带上游 URL。

### `GET /api/health`

用于本地/部署存活检查，不调用上游，不包含 D1 细节。

```ts
{ ok: true; data: { service: 'fangdi-mobile-api'; status: 'ok' } }
```

### `GET /api/home`

获取首页公开聚合数据。首版只返回 adapter 能确认的模块；未知模块可为空并带 `meta.source`，不得把空数据解释为上游无数据。

```ts
type HomeData = {
  notices: Notice[];
  recentHouses: HouseSummary[];
  sellUpcoming: SellUpcoming[];
  newPremises: HouseSummary[];
  houseBargain: BargainSummary[];
  secondHouse: HouseSummary[];
  policies: Notice[];
  news: Notice[];
};
```

`GET /api/home` 可使用约 60 秒 Cache API 缓存；缓存 key 只由固定 path 组成。

### `GET /api/notices?kind=proclamation|policy|news&page=1&pageSize=10`

公告、政策、要闻列表；page 从 1 开始，pageSize 取 1-20。详情只接收经过严格格式校验的 opaque `id`，不接受 HTML 或 URL。

```ts
type Notice = {
  id: string;
  title: string;
  publishedAt?: string;
  category?: string;
  summary?: string;
  detailUrl?: string; // 固定原站详情 URL 或相对安全链接
};
type Page<T> = { items: T[]; page: number; pageSize: number; total?: number; hasMore: boolean };
```

### `GET /api/trade`

交易统计当前快照。查询参数只允许固定枚举（例如 `scope=all|new|old`）；历史趋势/图表数据只有在真实 schema 验证后加入版本化字段。

```ts
type TradeData = {
  asOf?: string;
  newHouse?: TradeMetric;
  oldHouse?: TradeMetric;
  byDistrict?: Array<{ name: string; count?: number; area?: number }>;
  note?: string;
};
type TradeMetric = { count?: number; area?: number; amount?: number; averagePrice?: number };
```

约 5 分钟短缓存；首页统计和独立统计可以使用不同固定 cache key。

### `POST /api/new-house/search`

筛选新房列表。筛选条件和人工验证码都放在 JSON body，避免验证码文本或 session id 进入 URL、浏览器历史和缓存。允许的 body 字段由 `NewHouseFilter` 固定声明：

```ts
type NewHouseFilter = {
  district?: string;
  propertyType?: 'residential' | 'office' | 'commercial' | 'other';
  status?: 'available' | 'sold' | 'all';
  minArea?: number;
  maxArea?: number;
  projectName?: string;
  page: number;
  pageSize: number;
  captchaSession?: string;
  captchaText?: string;
};
```

仅浏览公开列表可不要求验证码（以真实上游要求为准）；上游要求验证码时返回 `CAPTCHA_REQUIRED`，前端先调用 `/api/captcha`。查询成功的响应不缓存；请求 body 不写入日志。

### `GET /api/new-house/:id`

详情 id 只允许有限长度的字母、数字、`_`、`-`；Worker 使用固定原站详情 adapter 或返回 `UPSTREAM_SCHEMA`，不能拼接任意路径。成功数据为白名单字段 `id/name/district/address/status/area/rooms/updatedAt/detailUrl`，缺字段为 `undefined`，不透传 HTML。

### `POST /api/old-house/search` 与 `GET /api/old-house/:id`

字段与新房类似。筛选条件和人工验证码放在 JSON body，使用独立 `OldHouseFilter`：

```ts
type OldHouseFilter = {
  district?: string;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  rooms?: number;
  propertyType?: 'residential' | 'office' | 'commercial' | 'other';
  keyword?: string;
  page: number;
  pageSize: number;
  captchaSession?: string;
  captchaText?: string;
};
```

二手房昨日成交快照如果可验证，作为 `/api/old-house/market-summary` 返回；其 `sellcount` 只作为上游字段映射，不把第三方旧资料当作实时保证。

### `GET /api/lease`

首版保证租赁信息可用，不假设房源列表存在：

```ts
type LeaseData = {
  faqs: Array<{ id: string; question: string; answer: string }>;
  downloads: Array<{ title: string; url: string; format?: string }>;
  links: Array<{ title: string; url: string }>;
  limitation: string;
};
```

`url` 只能来自代码内固定 allowlist（原站服务下载页、政府公开办理入口），不接受 query 传入 URL。约 1 小时缓存。

### `GET /api/captcha`

创建一次复杂查询验证码会话。Worker 只从固定上游 captcha endpoint 获取图片/挑战响应，并将图片安全地以 base64/data URL 或短期资源 token 形式返回；若上游 challenge 无法在 Worker 端稳定获取，返回 `UPSTREAM_BLOCKED`，绝不把上游 Cookie 回传。

```ts
type CaptchaData = {
  sessionId: string; // opaque random id, 前端短暂持有
  image: string;     // data:image/...;base64,...，不含上游地址/headers
  expiresAt: string;
};
```

`sessionId` 使用 CSPRNG 生成，D1 只保存不可逆 hash、过期时间、用途和必要的上游关联状态。默认 TTL 5 分钟，单 session 最多验证/提交 3 次，成功或过期立即删除。

### `POST /api/captcha/refresh`

请求：`{ sessionId: string }`。刷新前 session 必须属于短期未过期记录；旧记录删除后创建新会话。失败不返回旧上游凭据。

### `GET /api/search`（不实现）

不提供通用搜索/任意代理入口。新房与二手房必须通过各自固定路由，避免把 Worker 变成第三方 URL relay。

## 验证码查询状态机

```text
NO_CAPTCHA
   │ upstream says captcha required
   ▼
CAPTCHA_REQUIRED ── create ──▶ CAPTCHA_READY
   │                               │ user enters text
   │ refresh                         ▼
   └──────────────────────────▶ SUBMITTING
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
             CAPTCHA_INVALID  EXPIRED       SUCCESS / BLOCKED
             keep filters     clear session  delete session
```

验证码文本只在一次 HTTPS 请求体内存在，不进入 URL、缓存、持久日志或前端 analytics。前端刷新筛选条件时保留条件但清除 session。

## 参数验证规则

- 只接受契约列出的 query keys；未知 key 返回 `BAD_REQUEST`。
- page 为整数 `1..10000`；pageSize 为整数 `1..20`。
- 数值字段必须为有限非负数，`min <= max`；金额/面积上限按业务合理范围限制，超过即 400。
- 文本 trim 后长度 `1..80`；禁止控制字符、HTML 标签和极端重复输入。
- captchaText 只允许 `2..12` 个 ASCII 字母/数字（具体字符集以真实验证码确认）。
- id 只允许 `^[A-Za-z0-9_-]{1,80}$`。

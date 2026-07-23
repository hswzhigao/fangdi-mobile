# 系统架构设计

**状态：设计已确认，待实现。**

## 目标拓扑

```text
                 local development
┌──────────────┐   /api proxy   ┌────────────────┐
│ Vite dev     │ ─────────────▶ │ Worker :8787   │
│ Vue frontend │                │ local adapter │
└──────────────┘                └───────┬────────┘
                                        │ HTTPS fixed URLs
                                        ▼
                                fangdi.com.cn public APIs

                 PinMe deployment
┌──────────────────┐  VITE_API_URL  ┌──────────────────┐
│ frontend/ dist   │ ─────────────▶ │ {name}.pinme.pro │
│ Vue + Vant       │ same UI host   │ Cloudflare Worker │
└──────────────────┘                └──┬─────────┬────┘
                                      │         │
                                      ▼         ▼
                              upstream site   D1 sessions
```

PinMe 官方模板以 `pinme create <dir>` 生成 React/Vite + Worker + D1 全栈项目。本项目需要先用模板创建，再把前端改成 Vue 3；不要手工修改自动生成的 `pinme.toml`、`backend/wrangler.toml` 和 `frontend/.env`，除非 PinMe CLI 生成结果明确要求。最终用 `pinme save` 进行完整部署；仅改后端或前端时分别使用 `pinme update-worker` / `pinme update-web`。

## 目录职责

```text
pinme.toml                         # PinMe 生成；不手改
package.json                       # workspace scripts 和开发依赖
backend/src/worker.ts              # Worker 入口、路由、错误边界
backend/src/routes.ts              # 固定 API 路由分派（可按模板拆分）
backend/src/upstream/               # 上游固定 endpoint adapter + normalizer
backend/src/captcha/                # captcha session、哈希、TTL 清理
backend/src/cache/                  # Cache API 读写与 TTL header
backend/src/validation/             # URLSearchParams/body 白名单校验
backend/test/                       # Worker contract/unit tests

db/001_init.sql                     # captcha_sessions 表与索引
frontend/src/main.ts                # Vue mount、Vant、全局样式
frontend/src/App.vue                # 移动端壳、五 Tab、全局错误入口
frontend/src/router.ts              # 页面路由与固定 fallback
frontend/src/api/client.ts          # 唯一 fetch 封装
frontend/src/api/types.ts           # 前端稳定数据契约
frontend/src/pages/                 # Home/NewHouse/OldHouse/Lease/Trade
frontend/src/components/            # filter sheet、captcha dialog、data states
frontend/src/styles/                # tokens、responsive layout、safe area
frontend/test/                      # component/API contract tests
```

实际 PinMe 模板生成的目录为准；如果模板只有 `worker.ts`，可先在同一文件内实现，再以职责拆分而不改变路由契约。

## 请求处理链

1. Worker 接收 `GET`/`POST` `/api/*`。
2. `OPTIONS` 仅返回 CORS 预检；生产 CORS origin 使用部署前端地址或同源，不使用凭据型 `*`。
3. 路由器以 HTTP 方法 + 精确 pathname 匹配；未知路径返回 `NOT_FOUND`。
4. 校验 query/body：分页上限 `pageSize <= 20`，字符串长度、数字范围、枚举和验证码输入格式全部 fail fast。
5. 选择固定 adapter；adapter 构造固定上游 URL 和固定 form body，不透传前端 headers/cookies。
6. adapter 处理上游状态码、JSON/text 响应和已知 schema；不符合 schema 时返回 `UPSTREAM_SCHEMA`，不猜测字段。
7. normalizer 输出稳定的 `ApiEnvelope<T>`，列表统一为 `{items, page, pageSize, total, hasMore}`。
8. 公开 GET 请求按 cache policy 尝试 Cache API；用户会话查询、验证码和错误响应不缓存。
9. 返回安全响应头：`Content-Type`、`X-Content-Type-Options: nosniff`、合理的 `Cache-Control`、不泄露上游头。

## 上游适配策略

### 已确认可尝试的固定端点

- 首页：`/service/index/getIndexMessage.action`、`getProclamation.action`、`getRecentHouse.action`、`getSellUpcoming.action`、`getNewPremises.action`、`getHosueBargain.action`、`getSecondHouse.action`、`getHousePolicies.action`、`getHouseNews.action`。
- 二手房昨日成交旁证：`/oldhouse/getSHYesterdaySell.action`，第三方资料记录过 `sellcount` 等字段，但不能替代当前联调。
- 新房/二手房页面、详情页面作为固定原站 fallback URL，不当作 Worker 任意代理。

### 不确定端点的处理

- 新房、二手房筛选参数和详情 schema 先在开发阶段用浏览器开发者工具低频确认；未确认前 adapter 不提交猜测请求。
- 租赁没有公开 API 证据，先实现资料/FAQ 静态展示与原站链接；不伪造租赁房源列表。
- 统计历史趋势接口未确认，先支持 Worker 能验证的当前统计数据；历史趋势若无可靠 endpoint，显示“原站查看完整统计”。

### WAF / challenge

Worker 不执行、逆向或模拟瑞数 challenge，不保存 challenge Cookie，也不向浏览器回传动态参数。如果固定上游 GET/POST 返回 412、验证码页面或非 JSON，映射为 `UPSTREAM_BLOCKED`，前端显示“上游访问验证失败”，提供固定原站入口。此限制是正式设计，不是待补的绕过点。

## 环境变量和密钥

- `VITE_API_URL`、PinMe 自动生成配置由 CLI 管理。
- 上游 base URL 固定为代码中的常量 `https://www.fangdi.com.cn`，不是来自用户输入。
- 若真实联调需要受控测试凭据，只放 Worker secret；不得写进 `.env`、源码、测试 fixture、响应或日志。当前公开版不依赖上游凭据。
- D1 绑定由 PinMe 模板生成；本地测试可使用 Wrangler/模板提供的本地 D1。

## 验证门槛

- 初始化后必须先验证 `GET /api/health`、一个首页端点的状态映射和一个上游阻断响应。
- 验证前端生产构建、Worker typecheck、单元测试和 `/api` 端到端调用。
- 部署前确认 `pinme --version`、登录状态、项目名和生成的 Worker URL；未登录或 CLI 不可用时只报告阻塞，不伪造部署 URL。

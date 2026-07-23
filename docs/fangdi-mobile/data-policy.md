# 数据与安全策略

**状态：设计已确认，待实现。**

## 数据分类

| 数据 | 来源 | 是否持久化 | 规则 |
|---|---|---|---|
| 首页/公告/统计公开数据 | 上游固定公开接口 | 仅 Cache API 短期 | 可缓存、白名单字段、带 fetchedAt |
| 筛选表单 | 用户浏览器内存/组件状态 | 否 | 路由离开即清理；不保存查询历史 |
| 验证码图片 | 上游固定验证码接口 | Worker 内存/响应 | 不缓存；前端只展示短期 data URL |
| captcha session 关联状态 | Worker + D1 | 是，最多 5 分钟 | 只存 hash、用途、过期时间、尝试次数和必要关联值；成功/过期删除 |
| challenge Cookie/token/动态参数 | 上游/WAF | 否 | Worker 不读取后向前端透传；如运行时自动产生，也不得写日志/DB |
| 上游原始 HTML/JSON | 上游 | 否 | 只在请求生命周期内解析；schema 失败后丢弃 |
| 用户身份/个人房产数据 | 不在范围 | 否 | 不实现登录和个人查询 |

## Cache API 策略

只缓存稳定公开数据；cache key 由固定 route 名和已校验参数组成，绝不使用用户提供的完整 URL。

| 路由 | TTL | 条件 |
|---|---:|---|
| `/api/home` | 60 秒 | GET，成功 envelope，非验证码流程 |
| `/api/notices` | 5 分钟 | GET，固定 kind/page/pageSize |
| `/api/trade` | 5 分钟 | GET，当前快照 |
| `/api/lease` | 1 小时 | GET，固定资料数据 |
| `POST /api/new-house/search` | 不缓存首版 | 筛选条件可能改变且可能需要验证码 |
| `POST /api/old-house/search` | 不缓存首版 | 同上 |
| `captcha/*`、详情、所有错误 | 0 | 永不写入 Cache API |

缓存读取规则：先读缓存，命中才返回 `cached: true`；miss 后请求上游，只有 schema 验证成功才写缓存。Cache API 的失败不影响主请求；上游失败不写空结果。

## D1 会话表

使用 PinMe 模板创建 `db/001_init.sql`：

```sql
CREATE TABLE IF NOT EXISTS captcha_sessions (
  session_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  upstream_ref TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_captcha_sessions_expiry
  ON captcha_sessions (expires_at);
```

`upstream_ref` 如果保存，只能是无法单独访问上游的服务端关联标识；不能是 Cookie、完整 URL、challenge query 或 token。优先不保存它，或保存加密/哈希后的 opaque reference。

### Session ID 规则

- `sessionId = base64url(random 32 bytes)`，只返回明文给当前浏览器。
- D1 保存 `SHA-256(sessionId + server-side salt)`，salt 用 Worker secret；代码和文档不包含 secret 值。
- 读取时同样 hash 后按 primary key 查询。
- 每次提交原子增加 attempts；超过 3 次返回 `CAPTCHA_EXPIRED` 或 `RATE_LIMITED`，并删除记录。
- TTL 清理在创建/读取时按需删除过期记录；可附加低频定时清理，但不能依赖定时任务保证正确性。

## CORS 和安全头

- 前端生产同源部署时不需要宽松 CORS；仍保留 `OPTIONS` 以支持本地开发。
- 允许 origin 使用环境配置的前端地址集合，开发时允许 `http://localhost:5173`；不回显任意 `Origin`。
- 不设置 `Access-Control-Allow-Credentials: true`，因为不使用浏览器凭据传递。
- API 响应包含 `X-Content-Type-Options: nosniff`，不透传上游 Set-Cookie、Server、WAF challenge body。
- 生产前端 CSP 由 PinMe/静态站部署方式复核；Vue 模板不使用 `v-html` 展示上游内容。

## 日志与错误

允许的日志内容：固定 route 名、HTTP 方法、状态类别、耗时区间、错误码、是否 cache hit。禁止日志：请求 URL 原文（尤其 query）、请求 body、验证码文本、sessionId、Cookie、Authorization、上游响应 body。

所有异常在边界处转成 `ApiErrorCode`；前端只显示通用中文 message。开发环境可用本地 request id 关联，但 request id 不能由用户输入且不与敏感值拼接。

## 限流

- Worker 对 captcha 创建/刷新和复杂查询设置按 IP/opaque client fingerprint 的短窗口限制；具体实现优先使用轻量内存限流，不能把 IP 当作长期个人档案。
- 单验证码 session 最多 3 次提交；刷新会使旧 session 失效。
- 429 响应带 `Retry-After` 秒数，但不暴露内部限流键。
- 不做批量详情预取、自动轮询或无限滚动抓取。

## 失败与降级

用户可见错误必须包含：发生了什么、是否可重试、下一步按钮。固定 fallback URL：

- 首页：`https://www.fangdi.com.cn/`
- 新房：`https://www.fangdi.com.cn/new_house/new_house.html`
- 二手房：`https://www.fangdi.com.cn/old_house/old_house.html`
- 租赁：`https://www.fangdi.com.cn/lease/lease.html`
- 统计：`https://www.fangdi.com.cn/trade/trade.html`

若上游返回 412 或 challenge HTML：提示“原站正在进行访问验证，移动版无法代替验证”，按钮为“打开原站”和“重试”；不展示混淆脚本、不把原始 body 当文本显示。

## 合规与来源

移动版页面标注“数据来源：网上房地产公开信息”，提供原站链接和“本页面为个人移动端适配，非官方客户端”说明。只处理公开信息；不收集账号、手机号、身份证、房产证、交易记录或用户行为历史。

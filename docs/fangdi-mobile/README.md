# 网上房地产移动版 Scope

**状态：设计已确认，待实现。**

## 目的与边界

本 scope 定义一个面向公开访问者的上海房地产公共信息移动版：用 Vue 3 重做移动端展示与交互，用 PinMe 全栈 Worker 提供同源白名单 API，有限复用 `fangdi.com.cn` 的公开业务页面和接口。

范围优先级：

1. B：首页、 一手房、二手房、租赁信息/FAQ、交易统计。
2. C：新房/二手房完整筛选、分页、详情和需要验证码的查询，能由真实上游契约支持到哪里就实现到哪里。
3. 上游无法稳定访问、schema 未确认或租赁没有真实房源接口时，不编造数据；展示已确认的资料/FAQ，并链接回原站。

不包含：登录、个人房产或交易数据、后台管理、在线签约、OCR、挑战逆向、验证码绕过、批量抓取、任意 URL 代理、保存上游 Cookie/令牌/动态 challenge 参数。

## 模块关系与所有权

```text
┌──────────────────┐      same-origin /api/*       ┌──────────────────────┐
│ Vue 3 + Vant UI  │ ────────────────────────────▶ │ PinMe Worker         │
│ pages + API client│ ◀─────────────────────────── │ allowlist + normalize │
└────────┬─────────┘                               └──────┬───────────────┘
         │                                                  │
         │ user-entered captcha text                        │ server-side only
         ▼                                                  ▼
┌──────────────────┐                               ┌──────────────────────┐
│ Captcha dialog    │                               │ Fangdi upstream      │
│ manual input      │                               │ fixed endpoints only │
└──────────────────┘                               └─────────┬────────────┘
                                                            │
                                         transient session │
                                                            ▼
                                                   ┌──────────────────────┐
                                                   │ D1 captcha sessions  │
                                                   │ TTL cleanup / hashes  │
                                                   └──────────────────────┘
```

- **Vue app** 创建页面状态、表单、路由状态和用户可见降级；不保存上游会话资料。
- **API client** 是前端唯一的网络调用入口，只接受本项目 `/api/*` 路径。
- **Worker router** 创建并调用上游 adapter，校验固定路由和参数，统一响应包与错误码。
- **Upstream adapter** 只拥有固定的上游 URL、方法和字段映射；禁止接收任意 URL。
- **D1 captcha session store** 仅由 Worker 创建/读取/销毁短期验证码会话；不保存用户查询历史。
- **Cache layer** 只缓存明确标记为公开、非个性化、短时有效的响应；不缓存验证码或带用户输入/会话的数据。

## 生命周期

```text
页面进入
  → API client 请求首页/FAQ/统计
  → Worker 校验路由 → adapter 请求上游
  → normalize 成稳定契约 → 可选短缓存 → 返回

复杂筛选
  → Worker 生成 captcha session
  → Vue 展示验证码图片和人工输入框
  → 用户输入文本提交查询
  → Worker 按 opaque session id 读取会话
  → 上游验证/查询；成功后立即销毁会话
  → 失败返回 captcha_invalid 或 upstream_blocked；用户可刷新验证码或打开原站
```

## 跨模块决策

- 前端正式环境只调用相对路径 `/api/*`；开发环境由 Vite 将 `/api` 代理至本地 Worker。
- Worker 只允许下表列出的路由，不实现 `/api/proxy?url=...` 或其它任意转发。
- 上游请求中的 challenge Cookie、动态参数、Worker 运行时凭据不能进入 JSON、日志或前端。
- 所有来自上游的内容先做白名单字段映射和长度限制，再交给前端；前端不渲染未清洗的 HTML。
- 上游失败必须返回统一错误码和可读 `message`，同时给出 `fallbackUrl`（仅固定原站页面 URL）。
- 租赁第一版按“FAQ、合同/资料下载、办理入口”交付；只有验证到真实列表接口后才添加房源筛选。
- 站点名称、版权/来源说明和原站链接保留，避免把移动版误认为官方授权服务。

## 子模块

- [系统架构](architecture.md)
- [API 契约](api-contract.md)
- [UI 布局](ui-layout.md)
- [数据与安全策略](data-policy.md)

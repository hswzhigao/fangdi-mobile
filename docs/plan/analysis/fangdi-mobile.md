# 移动版交付分析

## 目标

从空工作区交付 Vue 3 + Vite + TypeScript + Vant 移动端，以及 PinMe 全栈 Worker API。用户只面向公开数据；首页、新房、二手房、租赁资料/FAQ、交易统计为优先范围，复杂筛选/分页/详情/人工验证码尽量实现但必须服从真实上游契约。

## 证据与设计约束

- 当前目标站是传统 MPA + jQuery AJAX；首页已观察到多个 `/service/index/*.action` POST 接口，但公开调查没有完整 JSON schema。
- 上游存在 JS challenge/WAF。Worker 不绕过、逆向或透传 challenge；失败必须 `UPSTREAM_BLOCKED` + 固定原站入口。
- 租赁只有入口和资料下载证据，没有房源列表 API 证据；第一版交付 FAQ/资料，不伪造列表。
- PinMe 模板按官方 skill 使用 `pinme create`、`pinme save`、`pinme update-worker`、`pinme update-web`；CLI 不可用时记录阻塞。
- 代码基线需先初始化 Git，以便任务隔离和审查；不提交任何 secret。

## 模块分解

### 1. bootstrap

输入：空工作区、PinMe CLI/template。输出：可运行 monorepo、Vue 入口、Worker `/api/health`、typecheck/test/build 脚本。依赖：无。验证：本地启动和 health。

### 2. worker core

输入：Worker Request、route contract。输出：固定路由分派、参数校验、统一 `ApiEnvelope`、CORS/安全头、错误映射。依赖：bootstrap。验证：未授权路径、未知 query、OPTIONS、异常映射。

### 3. public content adapters

输入：固定上游 endpoint 结果。输出：首页/公告/统计/租赁结构化数据和 Cache API。依赖：worker core。验证：用录制的无敏感响应 fixture 测 parser；真实上游阻断时得到 `UPSTREAM_BLOCKED`。

### 4. captcha session

输入：用户请求的固定 captcha purpose。输出：opaque session、短期 D1 记录、手动验证码流程、尝试限制和无凭据图片响应。依赖：worker core。验证：TTL、哈希、不重复使用、错误状态和敏感值不进响应/日志。

### 5. search adapters

输入：校验后的 `NewHouseFilter`/`OldHouseFilter` 和短期 captcha session。输出：列表 Page、详情白名单字段。依赖：worker core、captcha session。验证：参数拒绝、分页、未知 schema 不伪造、上游 block 降级。

### 6. Vue shell/content

输入：稳定 API client 契约。输出：首页、租赁、统计、底部 Tab、loading/empty/error/fallback。依赖：bootstrap、content adapters。验证：组件测试和浏览器移动 viewport smoke。

### 7. Vue search UX

输入：search API + captcha API。输出：筛选 sheet、chips、分页、详情、CaptchaDialog。依赖：Vue shell、search adapters、captcha session。验证：人工输入路径、刷新失效、错误恢复和不重复提交。

### 8. integration/release

输入：完整前后端。输出：端到端本地验收、生产构建、PinMe save 前检查和部署记录。依赖：全部前置任务。验证：health、API same-origin/proxy、真实上游可用/阻断两种路径、无敏感日志。

## 集成关系清单

| 调用链 | 集成任务 | 验证 |
|---|---|---|
| Vite `/api` → Worker | `bootstrap-001`, `frontend-006`, `integration-008` | dev proxy + fetch health |
| Worker router → fixed adapter | `worker-002`, `content-003`, `search-005` | real route with fixture/blocked response |
| Worker → D1 captcha store | `session-004`, `search-005` | create/read/delete/TTL path |
| Vue API client → normalized envelope | `frontend-006`, `frontend-007` | client error mapping + component state |
| PinMe generated API URL → production frontend | `bootstrap-001`, `integration-008` | build configuration inspection and deploy dry check |

## 交付门槛

1. 所有实现任务均有任务文件和独立测试。
2. 不允许以 TODO/mock/fake 作为最终对接路径；fixture 只能测试纯解析器或错误映射。
3. 在真实上游 schema 未确认处返回明确错误或已确认资料，不猜测成功数据。
4. `npm run typecheck`、`npm test`、`npm run build` 和本地 Worker smoke 全部有输出证据后，才能声称完成。
5. PinMe 登录和部署若未执行，只能报告“本地验证完成、远端部署未执行”。

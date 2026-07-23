# 交付计划目录

本目录采用 docs-sprint 的 develop → verify → merge 流程。当前工作区尚未初始化 Git 仓库，也没有安装 PinMe CLI，因此首个任务先建立可验证的项目基线；在登录 PinMe 前不执行远端部署。

## 状态约定

```text
pending → ready → in-progress → done
                         └──────→ blocked
```

- `pending`：依赖未完成。
- `ready`：所有依赖已完成，可建立隔离分支执行。
- `in-progress`：开发或验证进行中。
- `done`：开发、验证、合并和全量检查完成。
- `blocked`：外部条件未满足，记录具体原因，不把预期结果当成功。

## 任务顺序

| ID | 交付物 | 依赖 |
|---|---|---|
| `bootstrap-001` | PinMe 模板改造成 Vue 3 前端、Worker health 基线、测试脚本 | 无 |
| `worker-002` | Worker 错误包、白名单路由、参数校验、CORS、安全头 | `bootstrap-001` |
| `content-003` | 首页、公告、统计、租赁资料的固定适配器和缓存 | `worker-002` |
| `session-004` | D1 短期验证码 session、限流和验证码路由契约 | `worker-002` |
| `search-005` | 新房/二手房列表、详情和可验证的上游适配器 | `worker-002`, `session-004` |
| `frontend-006` | Vue 移动端壳、API client、首页/租赁/统计页面 | `bootstrap-001`, `content-003` |
| `frontend-007` | 新房/二手房筛选、分页、详情、人工验证码交互 | `frontend-006`, `search-005` |
| `integration-008` | 端到端降级、移动端验收、PinMe 部署前验证 | `content-003`, `session-004`, `search-005`, `frontend-007` |

任务文件列出精确路径和验证命令。两个任务只有在路径完全不重叠且依赖已完成时才能并行；当前无 Git worktree，默认串行。

## 审查规则

每个任务提交后由独立 verify agent 阅读任务文件、设计文档和代码，写入 `docs/plan/reviews/{id}-1.md`。与契约不一致、仍有 mock/stub/fake 对接路径或泄露敏感数据均为 blocking；合理但未影响契约的改进记入 `docs/plan/backlog.md`。

## 任务入口

- [规划分析](analysis/fangdi-mobile.md)
- [bootstrap-001](tasks/bootstrap-001.md)
- [worker-002](tasks/worker-002.md)
- [content-003](tasks/content-003.md)
- [session-004](tasks/session-004.md)
- [search-005](tasks/search-005.md)
- [frontend-006](tasks/frontend-006.md)
- [frontend-007](tasks/frontend-007.md)
- [integration-008](tasks/integration-008.md)

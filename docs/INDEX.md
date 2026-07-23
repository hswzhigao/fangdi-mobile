# 网上房地产移动版文档索引

本目录是 Vue 3 移动版与 PinMe Worker 的唯一设计文档入口。线上勘探报告只作为证据来源，不作为实现契约。

## 设计范围

- [移动版 scope README](fangdi-mobile/README.md)：模块边界、所有权、生命周期与跨模块决策。
- [系统架构](fangdi-mobile/architecture.md)：Vue 前端、PinMe Worker、D1 短期会话、上游适配器与部署方式。
- [API 契约](fangdi-mobile/api-contract.md)：前端 `/api/*` 路由、输入输出、错误码、分页、验证码流程。
- [UI 布局](fangdi-mobile/ui-layout.md)：五 Tab 移动端壳、页面结构、交互和状态变体。
- [数据与安全策略](fangdi-mobile/data-policy.md)：缓存、短期验证码会话、日志和隐私边界。

## 交付计划

- [计划目录说明](plan/README.md)
- [规划分析](plan/analysis/fangdi-mobile.md)
- [Superpowers 实施计划](superpowers/plans/2026-07-23-fangdi-mobile.md)
- [任务目录](plan/tasks/)

## 线上证据

以下文件记录了对公开站点的低频、只读调查。它们明确区分事实、推断和未验证事项，不能被实现代码当作已确认的上游 JSON schema：

- [架构分析](../architecture-analysis.md)
- [Round 1 工作证据](../working-evidence-round1.md)
- [Round 2 工作证据](../working-evidence-round2.md)
- [Round 3 工作证据](../working-evidence-round3.md)
- [Round 3 最终审计](../final-audit-round3.md)

## 文档维护规则

1. API 字段、错误码和状态流只在 `fangdi-mobile/api-contract.md` 定义。
2. 跨模块关系只在 `fangdi-mobile/README.md` 和 `architecture.md` 定义；任务文件只引用它们。
3. 如果实现发现上游真实接口与契约不符，先更新设计文档和任务，再改代码。
4. 上游不稳定、被 WAF/动态 challenge 拦截或 schema 无法确认时，必须返回明确错误并保留原站入口，不得以猜测字段伪造成功数据。

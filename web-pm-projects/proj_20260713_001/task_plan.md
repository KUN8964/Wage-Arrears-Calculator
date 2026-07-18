# Task Plan

## Current Progress

- 当前阶段：审查问题依次整改与本地回归验证。
- 当前交付目标：统一金额分币口径、无损迁移任职状态、在职跨日存档复核、自动结清状态、CSV 安全导出、CI 发布门槛和依赖安全。

## Stage Checklist

| Stage | Name | Status |
|---|---|---|
| 0 | 启动与历史检查 | Done |
| 1 | 全局目标与用户视角 | Done |
| 2 | 业务流程与页面结构 | Done |
| 3 | 技术偏好与兼容约束 | Done |
| 4 | 质量自检 | Done |
| 5 | 需求文档交付 | Done |
| 5.5 | 测试优先实施计划 | Done |
| 6 | 用户确认与持续迭代 | Done |
| 7 | 引导模式第一阶段实现 | Completed |
| 8 | 回归验证、提交与部署 | Completed |
| 9 | 实缴金额主输入与法规比例提示 | Completed |
| 10 | 增强版本提交与部署 | Completed |
| 11 | 移除合同开始日并简化双倍工资问题 | Completed |
| 12 | 合同月薪金额卡视觉改造 | Completed |
| 13 | 缴费基数回退、实缴比例反推与最低比例兜底 | Completed |
| 14 | 五险费率拆分、实际申报基数与旧数据迁移 | Completed |
| 15 | 回归验证、提交与双端部署 | Completed |
| 16 | 报销事项、计入合计口径与本地数据升级 | Completed |
| 17 | A4 报告模板、打印导出与可访问性 | Completed |
| 18 | 回归验证、提交与双端部署 | Completed |
| 19 | 瑞士国际主义报告网格、语义表格与极简视觉升级 | Completed |
| 20 | 年假、加班与调休法律口径和数据契约 | Completed |
| 21 | 纯函数测试与引导式输入实现 | Completed |
| 22 | 总计、报告、备份迁移与回归验证 | Completed |
| 23 | GitHub Pages 与 Sites 双端部署 | Completed |
| 24 | 三项权益卡片关闭交互与草稿保留测试 | Completed |
| 25 | 回归验证与双端发布 | Completed |
| 26 | 产品名称统一与年假折算说明测试 | Completed |
| 27 | 回归验证与双端发布 | Completed |
| 28 | 离职经济补偿纯函数、交互与报告接入 | Completed |
| 29 | 回归验证与双端发布 | Completed |
| 30 | 任职状态截止日与逐月工资手工调整 | Completed |
| 31 | 金额分币、旧存档迁移、结清状态与 CSV 安全整改 | Completed |
| 32 | CI 门槛、类型覆盖、依赖审计与完整回归 | Completed |

## MVP Scope After Confirmation

- 引导模式与精算模式双层结构。
- 当前任职状态、入职日期、合同月薪和条件显示的离职日期，以及按事项条件展示。
- 工资欠薪、合同期满、社保、公积金的最少问题集。
- 所有系统推定值可见、可修改。
- 汇总优先、异常月优先、完整台账折叠。
- 旧 localStorage 与 JSON 备份无损迁移。

## Locked Contract Summary

- 27 项 LOCKED 合同已记录在 `findings.md`；其中第 27 项由用户本轮明确确认。
- 编码开始前，执行者必须逐项复述并获得用户确认。

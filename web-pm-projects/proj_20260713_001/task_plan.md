# Task Plan

## Current Progress

- 当前阶段：合同问题简化已发布。
- 当前交付目标：移除不参与计算的合同开始日，只保留易懂的合同期满日问题。

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

## MVP Scope After Confirmation

- 引导模式与精算模式双层结构。
- 三个基础事实字段和按事项条件展示。
- 工资欠薪、合同期满、社保、公积金的最少问题集。
- 所有系统推定值可见、可修改。
- 汇总优先、异常月优先、完整台账折叠。
- 旧 localStorage 与 JSON 备份无损迁移。

## Locked Contract Summary

- 17 项 LOCKED 合同已记录在 `findings.md`；其中 7 项来自用户持续确认。
- 编码开始前，执行者必须逐项复述并获得用户确认。

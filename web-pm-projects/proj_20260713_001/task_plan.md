# Task Plan

## Current Progress

- 当前阶段：引导模式第一阶段验证与发布。
- 当前交付目标：默认引导、条件问题、推定确认、异常月结果与折叠精算明细。

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
| 8 | 回归验证、提交与部署 | In progress |

## MVP Scope After Confirmation

- 引导模式与精算模式双层结构。
- 三个基础事实字段和按事项条件展示。
- 工资欠薪、合同期满、社保、公积金的最少问题集。
- 所有系统推定值可见、可修改。
- 汇总优先、异常月优先、完整台账折叠。
- 旧 localStorage 与 JSON 备份无损迁移。

## Locked Contract Summary

- 15 项 LOCKED 合同已记录在 `findings.md`；其中 5 项来自本次用户确认。
- 编码开始前，执行者必须逐项复述并获得用户确认。

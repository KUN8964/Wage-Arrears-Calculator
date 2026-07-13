# 薪保计算器低成本使用改造 Structured Requirements v1.0

## Defensive Development Instruction

You are not the system designer. You are the contract executor.
Your primary goal is to strictly follow locked requirements.
If you believe a design is unreasonable, ask the user first; do not modify it directly.

Before generating code, output:
1. The number of LOCKED contracts read.
2. The core content of every LOCKED contract.
3. A statement that you will follow the execution priority and will not alter locked content without approval.

禁止范围蔓延、字段名污染、自行修改计算口径、静默增加默认假设、使用占位实现，以及在没有验证证据时宣称完成。

## Execution Priority

1. LOCKED contracts
2. Data contracts
3. API contracts
4. Interaction contracts
5. State-machine contracts
6. TDD: RED-GREEN-REFACTOR
7. Page structure
8. UI polish
9. Developer discretion

## Project Overview

- Name: 薪保计算器低成本使用改造
- ID: `proj_20260713_001`
- Description: 将专业计算表改造成普通用户能用生活事实完成的引导式计算器，同时保留专业精算能力。
- Target users: 普通劳动者优先，法律服务和人事核算人员为次级用户。
- Product perspective: 首次使用成本优先，计算透明度与可复核性不可牺牲。
- Current status: 用户已确认默认引导模式与缴费比例自动反推规则；实现与验证进行中。

## LOCKED Contracts

1. 无需注册登录，打开即可计算。
2. 案例数据默认只存当前浏览器，不上传业务数据。
3. 合计包含欠薪、未续签双倍工资、社保公司尚欠和公积金公司尚欠。
4. 社保、公积金公司实缴金额和实缴月份必须计入，尚欠额按月抵扣后计算。
5. 合同期满继续用工满一个月自动启用额外一倍工资，期满次日起算，最多 11 个月。
6. 保留逐月修正、保存、JSON 备份恢复和 CSV 导出。
7. 本轮首要目标是减少普通用户输入量和专业理解成本。
8. 实现遵循 RED-GREEN-REFACTOR。
9. 不允许占位逻辑和含糊字段。
10. 完成声明必须有测试与构建证据。
11. 默认入口采用引导模式，完整逐月台账折叠为精算明细。
12. 初始必填仅为入职日期、统计截止日期和合同月薪；截止日期默认当天。
13. 四类事项按用户选择条件展示，未选择事项不渲染问题且不进入合计。
14. 实缴开始月允许系统推定，但必须显式标识并允许修改。
15. 本阶段先展示汇总和异常月份，不引入地区政策库；最低比例显示默认来源边界并允许用户按当地规则修改。
16. 社保、公积金模块优先填写公司实际每月缴纳金额；公积金默认最低单位比例 5%，社保以养老单位部分 16% 作为保守最低基线且明确合计比例需按参保地调高。
17. 双倍工资引导仅询问合同期满日，不询问未参与计算的合同开始日；字段文案使用“合同上写的最后一天”。
18. 未填写缴费基数时按合同月薪作为缺省测算基数；实缴比例按“公司实际月缴金额 ÷ 测算基数”反推，系统采用反推比例与用户确认的当地最低比例中的较高值；基数和最低比例均可手工修改。

## PROTECTED Product Decisions

以下决策仍需用户后续确认，不属于第一阶段实施范围：

1. 社保、公积金政策自动模式的首批地区、有效期和可审计数据来源。
2. 支持粘贴月份与金额记录，处理断缴和金额变化。
3. 支持本地保存并复用自定义缴费口径预设。

## User Roles And Permissions

### 普通计算用户

- 可以新建、计算、修改、保存、备份、恢复和导出自己的本地案例。
- 默认进入引导模式，不要求理解专业字段。
- 可以查看每项推定依据并切换到精算模式。

### 专业复核用户

- 使用同一页面，不新增账号角色。
- 可以展开逐月台账，修改每月工资、实缴、基数和比例。
- 可以查看所有计算公式、触发日期和例外月份。

## Core Flow

### Step 1 · 基础事实

用户看到三个字段：

1. 入职日期，必填。
2. 统计截止日期，默认当天，可修改。
3. 合同月薪，必填。

三个字段完成后，系统建立月份范围，但不立即假定存在欠薪或漏缴情形。

### Step 2 · 选择发生的事项

使用四个多选卡片：

- 工资少发或未发
- 社保少缴或未缴
- 公积金少缴或未缴
- 合同期满后仍继续工作

未选择的事项不得显示其输入字段，也不得产生该项欠款。

### Step 3 · 回答模块问题

#### 工资模块

- 开始欠薪月份。
- 首个欠薪月已发比例，默认 0%，提供 0%、30%、50%、100% 和自定义。
- 开始欠薪前推定为足额发放，之后推定为未发；每个推定都在确认页说明。

#### 合同到期模块

- 合同期满日。
- 不询问合同开始日，因为该值不参与本系统的双倍工资计算。
- 统计截止日作为持续用工截止日。
- 未达到一个月时显示具体满月判定日；达到时自动计入总计。

#### 社保模块

- 公司是否实际缴纳过：是或否。
- 选择“是”后填写公司最近一个月实缴金额和最后实缴月份。
- 实缴开始月默认等于入职月份，并显示“系统推定”。
- 连续区间内使用最近月金额；用户可通过粘贴记录或异常月编辑覆盖。
- 未填写缴费基数时按合同月薪推定，折叠入口允许手工修改。
- 反推实缴比例，并与可修改的当地最低公司比例取高后计算应缴。

#### 公积金模块

- 问题结构与社保一致，数据与计算独立。
- 不得默认社保和公积金实缴期间或金额相同。
- 最低单位比例默认 5%，提供 5%、7%、10%、12% 快捷值并允许手工修改。

### Step 4 · 推定确认

在生成结果前展示一张确认清单：

- 用户填写的事实。
- 系统推定的值及推定原因。
- 缺少但不会阻止估算的信息。
- 会显著影响结果且必须补充的信息。

用户可以直接修改任何推定值。只有通过确认后，系统才更新当前月度明细。

### Step 5 · 结果与复核

- 第一层：当前合计欠款和四类金额卡片。
- 第二层：每类的应计月份、实缴月份、实缴总额、差额月份、尚欠金额和计算依据。
- 第三层：仅展示异常月份，例如欠薪、断缴、少缴、合同超期。
- 第四层：“查看精算明细”展开完整逐月台账。

## Interaction Contracts

- 初始首屏不得同时展示超过三个必填输入。
- 选择事项后只显示对应模块的问题。
- 系统推定值必须有可见标识，标识内容包含推定来源。
- 修改上游字段后，受影响的推定值必须重新计算并提示影响范围。
- 已由用户手动修改的值不得被后续自动推定静默覆盖。
- 切换引导模式与精算模式不得丢失数据。
- 粘贴记录的解析结果必须在写入明细前预览，并显示无法识别的行。

## State Machine Contracts

引导流程状态为：

1. `basic`：基础事实未完成。
2. `scenario`：基础事实完成，等待选择事项。
3. `questions`：至少选择一个事项，回答条件问题。
4. `review`：必要问题完成，核对事实与推定。
5. `results`：用户确认，显示结果。

任一状态都允许返回上一步。返回不得删除已填写字段；取消某事项时保留该事项草稿但从计算中排除。

## Data Contracts

### Case Settings

- `employmentDate`: `YYYY-MM-DD`
- `cutoffDate`: `YYYY-MM-DD`
- `contractPay`: non-negative number
- `selectedClaims`: subset of `wage | social | fund | doublePay`
- `inferenceOverrides`: map of explicitly overridden inferred fields
- `flowStep`: `basic | scenario | questions | review | results`

### Contribution Setup

社保和公积金分别保存：

- `enabled`: boolean
- `hasActualPayments`: boolean
- `actualMonthlyAmount`: non-negative number
- `actualStartMonth`: `YYYY-MM`
- `actualEndMonth`: `YYYY-MM`
- `calculationBase`: non-negative number；为空时回退到 `contractPay`
- `minimumCompanyRate`: positive percentage；社保默认 16，公积金默认 5
- `inferredActualRate`: `actualMonthlyAmount / effectiveCalculationBase * 100`
- `effectiveCompanyRate`: `max(inferredActualRate, minimumCompanyRate)`
- `monthlyOverrides`: map keyed by `YYYY-MM`

旧字段 `socialPaidStartMonth`、`socialPaidEndMonth`、`fundPaidStartMonth`、`fundPaidEndMonth` 必须迁移到对应 Contribution Setup；旧月度行不得重建或丢失。

### Storage Contracts

- 保留现有 `xinbao-rows`、`xinbao-double-rule`、`xinbao-meta` 键，或通过一次性迁移写入新版本后继续兼容读取。
- JSON 导入必须支持当前版本 4。
- 新 JSON 版本必须记录界面流程状态、事项选择和推定覆盖。
- CSV 继续导出完整逐月明细，不因默认折叠而减少列。

## Technical Constraints

- 保持 Next.js、React、vinext 和 Cloudflare Worker 兼容构建。
- 不引入账号系统和服务端案例数据库。
- 政策数据若实施，必须是可审计的版本化本地数据，包含地区、有效期、基数上下限、公司比例、来源名称和来源日期。
- 计算函数从页面组件中拆出为可单元测试的纯函数。
- 页面必须支持手机和桌面端，并可仅用键盘完成引导流程。

## Feature Grading

### MVP

- 引导模式与精算模式。
- 三个基础事实字段。
- 四类事项条件展示。
- 工资首月比例、合同到期自动规则。
- 社保、公积金“最近月实缴金额 + 最后实缴月”的连续区间快捷输入。
- 推定确认页。
- 汇总、异常月和折叠台账。
- 旧数据迁移。

### V1.1

- 粘贴月份与金额记录并预览解析。
- 本地保存可复用的自定义缴费口径预设。
- 结果完整度与推定数量提示。

### V1.2

- 版本化地区政策自动计算。
- 政策数据来源、有效期与更新检查。
- 多时间段基数或比例变化的批量规则。

## Input Cost Targets

- 初始首屏：最多三个必填字段。
- 仅计算欠薪：完成结果所需人工输入不超过五项。
- 连续缴费且金额稳定的全项测算：除事项选择外，人工输入或选择不超过十项。
- 任一模块未选择时，该模块可见输入为零。
- 用户不需要先理解“缴费基数”和“公司比例”才能进入结果页；系统展示合同月薪回退、比例反推和最低比例兜底过程，并提示最终以当地核定为准。

## Empty, Error And Recovery States

- 无事项选择：提示至少选择一项，不生成零意义台账。
- 日期倒置：在当前字段附近说明错误，不使用浏览器 alert 作为唯一提示。
- 缺少关键数据：保留已填内容，指出受影响的结果类别。
- 粘贴解析失败：展示失败行和原因，允许修正后重新预览。
- localStorage 数据损坏：保留新建入口并提示可从 JSON 备份恢复。
- 旧版本迁移失败：不得覆盖旧键，允许导出原始数据。

## Acceptance Criteria

1. 初次打开页面只看到三个基础必填字段和清晰的下一步，不看到完整专业表格。
2. 选择“仅欠薪”后，社保、公积金和合同字段均不渲染且不参与合计。
3. 实缴开始月等参与计算的推定值均显示“系统推定”及来源，可修改；合同开始日不出现在引导问题中。
4. 首个欠薪月填 30% 时，该月欠薪为合同月薪的 70%。
5. 合同到期继续用工未满一个月不计双倍工资，达到一个月后从期满次日起追溯，最多 11 个月。
6. 社保、公积金实缴金额先抵扣应缴金额，断缴月按 0，汇总显示实缴和尚欠。
7. 旧案例打开后金额、月份和逐月覆盖不变。
8. 引导模式和精算模式往返后数据一致。
9. 手机宽度下每一步无横向滚动；完整台账允许自身横向滚动。
10. 所有新增行为有失败测试、通过测试和成功构建证据。
11. 社保、公积金主问题展示“公司实际每月缴纳金额”；公积金可快捷选择 5%、7%、10%、12%，社保不得伪称存在全国统一合计比例区间。
12. 未填缴费基数时，生成行的基数等于合同月薪；实缴反推比例低于最低比例时采用最低比例，高于最低比例时采用反推比例。

## Verification Commands

```bash
npm test
npm run build
git diff --check
```

通过证据必须包含：纯计算测试、流程状态测试、旧数据迁移测试、服务端渲染测试和构建成功输出。

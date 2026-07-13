# Test-First Implementation Plan

## Preconditions

- 用户已确认默认引导、条件问题、显式推定、结果优先与折叠精算明细。
- 编码代理已复述 15 项 LOCKED 合同并声明不自行改变计算口径。
- 地区政策自动模式与缴费记录粘贴不进入第一阶段。
- 每个任务遵循 RED-GREEN-REFACTOR，并可独立提交。

## Task 1: 将计算与数据迁移拆成可测试纯函数

Files:
- Create: `lib/calculator.ts`
- Create: `lib/case-model.ts`
- Create: `tests/calculator.test.mjs`
- Create: `tests/case-migration.test.mjs`
- Modify: `app/page.tsx`

Step 1: Write failing test

- 覆盖首个欠薪月 30%、合同满月触发、11 个月上限、实缴抵扣、断缴月和版本 4 数据迁移。

Step 2: Run test and confirm failure

Command: `node --test tests/calculator.test.mjs tests/case-migration.test.mjs`

Expected: 因 `lib/calculator.ts` 和 `lib/case-model.ts` 尚不存在而失败，不是环境错误。

Step 3: Implement minimum behavior

- 从 `app/page.tsx` 提取纯函数和版本化迁移函数，保持现有结果不变。

Step 4: Run verification

Command: `npm test`

Expected: 新旧计算测试与当前渲染测试全部通过。

Step 5: Commit

Suggested message: `refactor: isolate calculator and case migration`

## Task 2: 建立引导流程状态机与基础事实页

Files:
- Create: `app/components/GuidedCalculator.tsx`
- Create: `tests/guided-flow.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

Step 1: Write failing test

- 断言初始状态为 `basic`，只渲染入职日期、统计截止日期、合同月薪三个必填字段。
- 断言截止日期默认当天，三个字段完成后才能进入 `scenario`。

Step 2: Run test and confirm failure

Command: `node --test tests/guided-flow.test.mjs`

Expected: 当前页面仍同时渲染全部输入，测试失败。

Step 3: Implement minimum behavior

- 添加显式流程状态和基础事实步骤，暂不移动计算逻辑。

Step 4: Run verification

Command: `npm test`

Expected: 初始字段数量和流程转换测试通过，旧计算测试保持通过。

Step 5: Commit

Suggested message: `feat: add guided calculator foundation`

## Task 3: 按事项条件展示工资与合同问题

Files:
- Create: `app/components/ClaimSelector.tsx`
- Create: `app/components/WageQuestions.tsx`
- Create: `app/components/ContractQuestions.tsx`
- Modify: `tests/guided-flow.test.mjs`

Step 1: Write failing test

- 选择“仅欠薪”时只出现欠薪开始月和首月已发比例。
- 首月 30% 生成 70% 欠薪。
- 合同事项未选择时双倍工资为 0；选择后按满月条件自动计算。

Step 2: Run test and confirm failure

Command: `node --test tests/guided-flow.test.mjs tests/calculator.test.mjs`

Expected: 条件模块和事项排除逻辑不存在，测试失败。

Step 3: Implement minimum behavior

- 引入 `selectedClaims`，取消事项时保留草稿但从计算中排除。

Step 4: Run verification

Command: `npm test`

Expected: 条件展示、草稿保留和计算排除测试通过。

Step 5: Commit

Suggested message: `feat: condition wage and contract questions by claim`

## Task 4: 社保、公积金快捷输入与显式推定

Files:
- Create: `app/components/ContributionQuestions.tsx`
- Create: `app/components/InferredValue.tsx`
- Modify: `lib/case-model.ts`
- Modify: `tests/guided-flow.test.mjs`
- Modify: `tests/calculator.test.mjs`

Step 1: Write failing test

- 实缴开始月自动等于入职月并带推定来源。
- 用户修改开始月后，修改值不被重新推定覆盖。
- 未选择社保或公积金时对应金额为 0。
- 最近月实缴金额应用于连续区间，异常月覆盖优先。

Step 2: Run test and confirm failure

Command: `node --test tests/guided-flow.test.mjs tests/calculator.test.mjs`

Expected: 推定覆盖和事项隔离逻辑不存在，测试失败。

Step 3: Implement minimum behavior

- 增加 `inferenceOverrides`，实现可见推定标识和覆盖优先级。
- 本任务只实现手动精算口径；政策自动模式保持不可选择并说明需要版本化政策数据，不返回估算金额。

Step 4: Run verification

Command: `npm test`

Expected: 推定、覆盖、连续区间和异常月测试通过。

Step 5: Commit

Suggested message: `feat: simplify contribution inputs with explicit inference`

## Task 5: 推定确认、汇总优先与异常月视图

Files:
- Create: `app/components/ReviewStep.tsx`
- Create: `app/components/ResultsSummary.tsx`
- Create: `app/components/ExceptionMonths.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/guided-flow.test.mjs`

Step 1: Write failing test

- 未确认推定前不重建月度明细。
- 结果页先显示合计、分类依据和异常月份。
- 完整台账默认折叠，展开后数据与异常视图一致。

Step 2: Run test and confirm failure

Command: `node --test tests/guided-flow.test.mjs`

Expected: review 与 results 状态及折叠明细不存在，测试失败。

Step 3: Implement minimum behavior

- 将确认动作设为唯一的批量重建入口，保留逐月编辑。

Step 4: Run verification

Command: `npm test`

Expected: 确认门槛、结果层级和数据一致性测试通过。

Step 5: Commit

Suggested message: `feat: add assumption review and exception-first results`

## Task 6: 旧数据兼容、导入导出与模式往返

Files:
- Modify: `lib/case-model.ts`
- Modify: `app/page.tsx`
- Modify: `tests/case-migration.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

Step 1: Write failing test

- 版本 4 JSON 导入后金额与月份不变。
- localStorage 三个旧键可读取。
- 引导模式和精算模式切换不改变行数据。
- 新 JSON 可再次导入，CSV 列保持完整。

Step 2: Run test and confirm failure

Command: `node --test tests/case-migration.test.mjs tests/rendered-html.test.mjs`

Expected: 新流程字段和双模式序列化尚未兼容，测试失败。

Step 3: Implement minimum behavior

- 增加单向版本迁移和兼容读取，迁移失败时不覆盖旧数据。

Step 4: Run verification

Command: `npm test`

Expected: 旧案例、新备份、CSV 和模式切换测试通过。

Step 5: Commit

Suggested message: `feat: preserve cases across guided-mode migration`

## Task 7: 响应式、键盘与最终验证

Files:
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

Step 1: Write failing test

- 所有字段有可访问名称，步骤和错误信息可被辅助技术识别。
- 页面源代码不重新引入登录、网络提交或未确认的政策默认值。

Step 2: Run test and confirm failure

Command: `node --test tests/rendered-html.test.mjs`

Expected: 新组件的可访问状态约束尚未全部满足，测试失败。

Step 3: Implement minimum behavior

- 完成焦点顺序、错误关联、手机单列布局和精算表格局部滚动。

Step 4: Run verification

Command: `npm test && npm run build && git diff --check`

Expected: 全部测试通过、生产构建成功、无空白错误或格式错误。

Step 5: Commit

Suggested message: `test: verify guided calculator accessibility and build`

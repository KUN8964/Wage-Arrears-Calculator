import { expect, test, type Page } from "@playwright/test";

const validRow = {
  id:1, wageMonth:"2026-01", payDate:"", normalPay:0, note:"1 月工资", paid:0, status:"未结清",
  duePay:20_000, arrears:20_000, contractPay:20_000, socialPaid:0, socialBase:20_000,
  socialRate:28.9, socialDue:5_780, fundPaid:0, fundBase:20_000, fundRate:5, fundDue:1_000,
};

async function waitForHydration(page: Page) {
  await expect(page.getByLabel("统计截止日期", { exact:false })).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForHydration(page);
});

test("completes the guided wage flow, calculates the total and restores saved data", async ({ page }) => {
  await page.getByLabel("入职日期", { exact:false }).fill("2026-01-01");
  await page.getByLabel("统计截止日期", { exact:false }).fill("2026-03-31");
  await page.getByLabel("合同月薪", { exact:false }).fill("20000");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();

  await page.getByRole("button", { name:/工资少发或未发/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();
  await page.getByLabel("从哪个月开始欠薪？", { exact:false }).fill("2026-02");
  await page.getByRole("button", { name:"30%", exact:true }).click();
  await page.getByRole("button", { name:"下一步：核对推定 →" }).click();
  await page.getByRole("button", { name:"确认并生成结果 →" }).click();

  await expect(page.getByText("当前合计 ¥ 34,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("2026-02", { exact:true })).toBeVisible();
  await expect(page.getByText("实际欠薪期间", { exact:true })).toBeVisible();
  await expect(page.getByText("2026-02 至 2026-03", { exact:true })).toBeVisible();
  await expect(page.getByText("共 2 个欠薪月份", { exact:false })).toBeVisible();
  await page.getByRole("button", { name:"查看精算明细", exact:true }).click();
  const monthlyArrearsHeader = page.getByRole("columnheader", { name:"本月欠款", exact:true });
  await expect(monthlyArrearsHeader).toBeVisible();
  const monthlyArrearsHeaderPosition = await monthlyArrearsHeader.evaluate(element => {
    const style = getComputedStyle(element);
    return { position:style.position, top:style.top, right:style.right };
  });
  expect(monthlyArrearsHeaderPosition).toEqual({ position:"sticky", top:"auto", right:"38px" });
  await expect(page.getByRole("heading", { name:"债权明确时，评估申请支付令" })).toBeVisible();
  await expect(page.getByRole("heading", { name:"恶意欠薪：符合条件时启动刑事线索移送" })).toBeVisible();
  await expect(page.getByLabel("根据测算生成的下一步行动方案").getByText("存在欠薪不等于犯罪；需结合逃避支付或有能力而拒不支付、数额较大，以及经政府有关部门责令支付后仍不支付等条件", { exact:true })).toBeVisible();
  await page.getByRole("button", { name:"保存", exact:true }).click();
  await expect(page.getByRole("button", { name:"已保存 ✓", exact:true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("当前合计 ¥ 34,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("测算结果已生成", { exact:true })).toBeVisible();
});

test("lets the user close an accidentally selected optional claim and continue", async ({ page }) => {
  await page.getByLabel("入职日期", { exact:false }).fill("2026-01-01");
  await page.getByLabel("统计截止日期", { exact:false }).fill("2026-03-31");
  await page.getByLabel("合同月薪", { exact:false }).fill("20000");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();

  await page.getByRole("button", { name:/工资少发或未发/ }).click();
  await page.getByRole("button", { name:/未休年假折现/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();
  await expect(page.getByRole("button", { name:"关闭未休年假折现" })).toBeVisible();
  await page.getByRole("button", { name:"关闭未休年假折现" }).click();

  await expect(page.getByRole("button", { name:"关闭未休年假折现" })).toHaveCount(0);
  await expect(page.getByLabel("从哪个月开始欠薪？", { exact:false })).toBeVisible();
  await page.getByLabel("从哪个月开始欠薪？", { exact:false }).fill("2026-02");
  await page.getByRole("button", { name:"30%", exact:true }).click();
  await page.getByRole("button", { name:"下一步：核对推定 →" }).click();
  await page.getByRole("button", { name:"确认并生成结果 →" }).click();

  await expect(page.getByText("当前合计 ¥ 34,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("未休年假折现", { exact:true })).toHaveCount(0);
});

test("explains missing or conflicting answers and jumps directly to the field", async ({ page }) => {
  await page.getByLabel("入职日期", { exact:false }).fill("2026-01-01");
  await page.getByLabel("统计截止日期", { exact:false }).fill("2026-03-31");
  await page.getByLabel("合同月薪", { exact:false }).fill("20000");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();

  await page.getByRole("button", { name:/工资少发或未发/ }).click();
  await page.getByRole("button", { name:/未签订劳动合同或合同到期仍在工作/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();

  await expect(page.getByRole("heading", { name:"还有 2 项需要处理" })).toBeVisible();
  const continueButton=page.getByRole("button", { name:"检查 2 项后继续 →" });
  await expect(continueButton).toBeEnabled();
  await page.getByTestId("question-issue-wage-start").click();
  await expect(page.locator("#question-wage-start")).toBeFocused();
  await expect(page.locator("#question-wage-start")).toHaveAttribute("aria-invalid","true");

  await page.locator("#question-wage-start").fill("2025-12");
  await expect(page.getByText("开始欠薪月份必须位于入职月份和统计截止月份之间。", { exact:true })).toBeVisible();
  await page.locator("#question-wage-start").fill("2026-02");
  await expect(page.getByRole("heading", { name:"还有 1 项需要处理" })).toBeVisible();

  await page.locator("#question-contract-end").fill("2025-12-31");
  await expect(page.getByText("合同期满日不能早于入职日期。", { exact:true })).toBeVisible();
  await page.getByTestId("question-issue-contract-end").click();
  await expect(page.locator("#question-contract-end")).toBeFocused();
  await page.locator("#question-contract-end").fill("2026-02-28");

  await expect(page.getByText(/项需要处理/)).toHaveCount(0);
  await page.getByRole("button", { name:"下一步：核对推定 →" }).click();
  await expect(page.getByText("核对事实与系统推定", { exact:true })).toBeVisible();
});

test("rejects an imported backup containing an impossible date without changing the page", async ({ page }) => {
  const invalidBackup = {
    version:9,
    caseName:"非法日期备份",
    setup:{ employmentDate:"2026-01-01", cutoffDate:"2026-02-31", contractPay:20_000 },
    selectedClaims:["wage"],
    flowStep:"results",
    doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
    rows:[validRow],
  };
  const dialogPromise = page.waitForEvent("dialog");
  await page.locator('input[type="file"]').setInputFiles({
    name:"invalid-backup.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(invalidBackup)),
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain("cutoffDate不是有效日期");
  await dialog.dismiss();
  await expect(page.getByText("先填写三个基础事实", { exact:true })).toBeVisible();
  await expect(page.getByText("测算结果已生成", { exact:true })).toHaveCount(0);
});

test("imports a valid backup and renders its calculated result", async ({ page }) => {
  const validBackup = {
    version:9,
    caseName:"有效备份",
    setup:{ employmentDate:"2026-01-01", cutoffDate:"2026-01-31", contractPay:20_000, arrearsStartMonth:"2026-01" },
    selectedClaims:["wage"],
    flowStep:"results",
    doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
    rows:[validRow],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name:"valid-backup.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(validBackup)),
  });
  await expect(page.getByText("当前合计 ¥ 20,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("测算结果已生成", { exact:true })).toBeVisible();
});

test("renders a personalized enforcement route and expandable evidence list", async ({ page }) => {
  const routedBackup = {
    version:11,
    caseName:"社保与被迫离职路径测试",
    setup:{
      employmentDate:"2025-01-01", cutoffDate:"2026-01-31", contractPay:20_000,
      socialHasPaid:true, socialActualBase:5_000, socialBase:20_000,
      fundHasPaid:true, fundPaid:250, fundBase:20_000, fundRate:5,
      terminationType:"forced", terminationAveragePay:20_000,
      personalResignationSigned:"yes", forcedNoticeSent:"yes", forcedNoticeProof:"yes",
    },
    selectedClaims:["social", "fund", "termination"],
    flowStep:"results",
    doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
    rows:[{...validRow, arrears:0, socialPaid:1_445, socialDue:4_335, fundPaid:250, fundDue:750}],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name:"routed-backup.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(routedBackup)),
  });

  await expect(page.getByRole("heading", { name:"系统已按当前情况自动分流" })).toBeVisible();
  await expect(page.getByRole("heading", { name:"申请社会保险和住房公积金核查补缴" })).toBeVisible();
  await expect(page.getByRole("heading", { name:"已签普通离职文件，优先专业复核" })).toBeVisible();
  await expect(page.getByLabel("根据测算生成的下一步行动方案").getByText("高风险", { exact:true })).toBeVisible();
  const leadTitleMetrics = await page.locator(".action-plan-lead strong").evaluate(element => {
    const style = getComputedStyle(element);
    return { height:element.getBoundingClientRect().height, lineHeight:Number.parseFloat(style.lineHeight) };
  });
  expect(leadTitleMetrics.height).toBeLessThan(leadTitleMetrics.lineHeight * 1.5);

  await page.getByText("查看本案证据清单", { exact:false }).click();
  await expect(page.getByLabel("根据测算生成的下一步行动方案").getByText("官方社保缴费明细，尽量包含年度、险种、缴费工资或申报基数", { exact:true })).toBeVisible();
});

test("balances five enforcement routes without leaving an empty black row", async ({ page }) => {
  const fiveRouteBackup = {
    version:11,
    caseName:"五条维权路径布局测试",
    setup:{
      employmentDate:"2025-01-01", cutoffDate:"2026-01-31", contractPay:20_000,
      arrearsStartMonth:"2026-01", firstArrearsPaidRate:0,
      socialHasPaid:false, socialBase:20_000,
      fundHasPaid:false, fundBase:20_000, fundRate:5,
    },
    selectedClaims:["wage", "social", "fund"],
    flowStep:"results",
    doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
    rows:[{...validRow, wageMonth:"2026-01", arrears:20_000, socialPaid:0, socialDue:5_780, fundPaid:0, fundDue:1_000}],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name:"five-route-layout.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(fiveRouteBackup)),
  });

  const cards = page.locator(".action-route");
  await expect(cards).toHaveCount(5);
  const layout = await cards.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    const header = element.querySelector(":scope > div")?.getBoundingClientRect();
    const badge = element.querySelector(":scope > div > b")?.getBoundingClientRect();
    const title = element.querySelector("h3")?.getBoundingClientRect();
    const steps = element.querySelector("ol")?.getBoundingClientRect();
    const firstStepElement = element.querySelector("ol > li");
    const firstStep = firstStepElement?.getBoundingClientRect();
    const firstStepStyle = firstStepElement ? getComputedStyle(firstStepElement) : null;
    const firstStepColumns = firstStepStyle?.gridTemplateColumns.split(" ") || [];
    const stepBodyX = (firstStep?.x || 0) + Number.parseFloat(firstStepColumns[0] || "0") + Number.parseFloat(firstStepStyle?.columnGap || "0");
    const cautionElement = element.querySelector(".route-caution");
    const caution = cautionElement?.getBoundingClientRect();
    const cautionContentX = (caution?.x || 0) + Number.parseFloat(cautionElement ? getComputedStyle(cautionElement).paddingLeft : "0");
    return { x:rect.x, y:rect.y, width:rect.width, titleX:title?.x || 0, stepsX:steps?.x || 0, stepsY:steps?.y || 0, firstStepX:firstStep?.x || 0, stepBodyX, cautionContentX, headerY:header?.y || 0, headerHeight:header?.height || 0, headerWidth:header?.width || 0, badgeRight:badge?.right || 0, background:getComputedStyle(element).backgroundColor };
  }));
  expect(Math.abs(layout[0].y - layout[1].y)).toBeLessThanOrEqual(1);
  expect(layout[4].width).toBeGreaterThan(layout[0].width * 1.9);
  expect(layout[4].stepsX).toBeGreaterThan(layout[4].titleX + layout[4].width * .35);
  expect(layout[4].headerWidth).toBeGreaterThan(layout[4].width * .85);
  expect(layout[4].badgeRight).toBeGreaterThan(layout[4].x + layout[4].width * .9);
  expect(layout[4].stepsY).toBeGreaterThan(layout[4].headerY + layout[4].headerHeight);
  expect(layout[4].firstStepX).toBeGreaterThan(layout[4].stepsX + 20);
  expect(layout[0].background).toBe(layout[4].background);
  expect(layout[1].background).toBe(layout[2].background);
  expect(layout[0].background).not.toBe(layout[1].background);
  expect(layout[3].background).not.toBe(layout[4].background);
  for (const card of layout) {
    expect(Math.abs(card.stepBodyX - card.cautionContentX)).toBeLessThanOrEqual(2);
  }

  await page.setViewportSize({ width:390, height:844 });
  const mobileLayout = await cards.evaluateAll(elements => elements.map(element => {
    const firstStepElement = element.querySelector("ol > li");
    const firstStep = firstStepElement?.getBoundingClientRect();
    const firstStepStyle = firstStepElement ? getComputedStyle(firstStepElement) : null;
    const firstStepColumns = firstStepStyle?.gridTemplateColumns.split(" ") || [];
    const stepBodyX = (firstStep?.x || 0) + Number.parseFloat(firstStepColumns[0] || "0") + Number.parseFloat(firstStepStyle?.columnGap || "0");
    const cautionElement = element.querySelector(".route-caution");
    const caution = cautionElement?.getBoundingClientRect();
    return {
      width:Math.round(element.getBoundingClientRect().width),
      stepBodyX,
      cautionContentX:(caution?.x || 0) + Number.parseFloat(cautionElement ? getComputedStyle(cautionElement).paddingLeft : "0"),
    };
  }));
  const mobileWidths = mobileLayout.map(card => card.width);
  expect(Math.max(...mobileWidths) - Math.min(...mobileWidths)).toBeLessThanOrEqual(1);
  for (const card of mobileLayout) {
    expect(Math.abs(card.stepBodyX - card.cautionContentX)).toBeLessThanOrEqual(2);
  }
});

test("keeps forced-termination confirmations balanced on desktop and stacked on mobile", async ({ page }) => {
  const terminationBackup = {
    version:11,
    caseName:"解除通知布局测试",
    setup:{
      employmentDate:"2025-01-01", cutoffDate:"2026-07-17", contractPay:20_000,
      terminationType:"forced", terminationAveragePay:20_000,
      personalResignationSigned:"unknown", forcedNoticeSent:"yes", forcedNoticeProof:"unknown",
    },
    selectedClaims:["termination"],
    flowStep:"questions",
    doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
    rows:[validRow],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name:"termination-layout.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(terminationBackup)),
  });
  await page.getByRole("button", { name:"修改测算条件" }).click();

  const panel = page.locator(".termination-confirmations");
  await expect(panel.getByText("三个关键状态", { exact:true })).toBeVisible();
  const desktop = await panel.evaluate(element => {
    const fields = [...element.querySelectorAll("fieldset")].map(field => field.getBoundingClientRect());
    const status = element.querySelector(".termination-status")?.getBoundingClientRect();
    const panelRect = element.getBoundingClientRect();
    return {
      fieldCount:fields.length,
      fieldTops:fields.map(rect => Math.round(rect.top)),
      fieldWidths:fields.map(rect => Math.round(rect.width)),
      panelWidth:Math.round(panelRect.width),
      statusWidth:Math.round(status?.width || 0),
      background:getComputedStyle(element).backgroundColor,
    };
  });
  expect(desktop.fieldCount).toBe(3);
  expect(new Set(desktop.fieldTops).size).toBe(1);
  expect(Math.max(...desktop.fieldWidths) - Math.min(...desktop.fieldWidths)).toBeLessThanOrEqual(1);
  expect(desktop.statusWidth).toBeGreaterThan(desktop.panelWidth * .9);
  expect(desktop.background).not.toBe("rgb(10, 10, 10)");

  await page.setViewportSize({ width:390, height:844 });
  const mobile = await panel.evaluate(element => {
    const fields = [...element.querySelectorAll("fieldset")].map(field => field.getBoundingClientRect());
    return {
      fieldTops:fields.map(rect => Math.round(rect.top)),
      pageWidth:document.documentElement.scrollWidth,
      viewportWidth:document.documentElement.clientWidth,
    };
  });
  expect(new Set(mobile.fieldTops).size).toBe(3);
  expect(mobile.pageWidth).toBe(mobile.viewportWidth);
});

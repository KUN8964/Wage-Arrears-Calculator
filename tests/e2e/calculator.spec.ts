import { expect, test, type Page } from "@playwright/test";

const validRow = {
  id:1, wageMonth:"2026-01", payDate:"", normalPay:0, note:"1 月工资", paid:0, status:"未结清",
  duePay:20_000, arrears:20_000, contractPay:20_000, socialPaid:0, socialBase:20_000,
  socialRate:28.9, socialDue:5_780, fundPaid:0, fundBase:20_000, fundRate:5, fundDue:1_000,
};

async function waitForHydration(page: Page) {
  await expect(page.getByRole("button", { name:"当前在职" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("计薪截止日期", { exact:true })).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
}

async function fillDepartedBasics(page: Page, employmentDate: string, departureDate: string, monthlyPay = "20000") {
  await page.getByLabel("入职日期", { exact:false }).fill(employmentDate);
  await page.getByRole("button", { name:"已经离职" }).click();
  await page.getByLabel("离职日期", { exact:false }).fill(departureDate);
  await page.getByLabel("合同月薪", { exact:false }).fill(monthlyPay);
}

async function returnToQuestionsFromResults(page: Page) {
  await page.getByRole("button", { name:"修改测算条件" }).click();
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForHydration(page);
});

test("completes the guided wage flow, calculates the total and restores saved data", async ({ page }) => {
  await fillDepartedBasics(page, "2026-01-01", "2026-03-31");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();
  await expect(page.getByRole("heading", { name:"工资、社保、公积金、加班工资、年假、报销，统统算清" })).toHaveCount(0);

  await page.getByRole("button", { name:/工资少发或未发/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();
  await page.getByLabel("从哪个月开始欠薪？", { exact:false }).fill("2026-02");
  await page.getByRole("button", { name:"30%", exact:true }).click();
  await page.getByRole("button", { name:"下一步：核对推定 →" }).click();
  await page.getByRole("button", { name:"确认并生成结果 →" }).click();

  await expect(page.getByText("权益履行总额 ¥ 34,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("2026-02", { exact:true }).first()).toBeVisible();
  await expect(page.getByText("实际欠薪期间", { exact:true })).toBeVisible();
  await expect(page.getByText("2026-02 至 2026-03", { exact:true })).toBeVisible();
  await expect(page.getByText("共 2 个欠薪月份", { exact:false })).toBeVisible();
  await page.getByRole("button", { name:"查看精算明细", exact:true }).click();
  const monthlyArrearsHeader = page.getByRole("columnheader", { name:"本月权益履行", exact:true });
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
  await expect(page.getByText("权益履行总额 ¥ 34,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("测算结果已生成", { exact:true })).toBeVisible();
});

test("uses today for active employment and lets the user adjust a special wage month", async ({ page }) => {
  const today = await page.evaluate(() => {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();
    const pad = (value:number) => String(value).padStart(2, "0");
    return {
      date:`${year}-${pad(month)}-${pad(day)}`,
      firstDay:`${year}-${pad(month)}-01`,
      month:`${year}-${pad(month)}`,
      day,
      calendarDays:new Date(year, month, 0).getDate(),
    };
  });
  const expectedDue = Math.round(20_000 * today.day / today.calendarDays * 100) / 100;

  await expect(page.getByLabel("计薪截止日期", { exact:true })).toHaveText(today.date);
  await page.getByLabel("入职日期", { exact:false }).fill(today.firstDay);
  await page.getByLabel("合同月薪", { exact:false }).fill("20000");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();
  await page.getByRole("button", { name:/工资少发或未发/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();
  await page.getByLabel("从哪个月开始欠薪？", { exact:false }).fill(today.month);
  await page.getByRole("button", { name:"下一步：核对推定 →" }).click();
  await page.getByRole("button", { name:"确认并生成结果 →" }).click();

  const wageInput = page.getByLabel(`${today.month} 应发工资`, { exact:true });
  await expect(wageInput).toHaveValue(String(expectedDue));
  await expect(page.getByText(`在职 ${today.day}/${today.calendarDays} 个自然日`, { exact:true })).toBeVisible();
  await wageInput.fill("10000");
  await page.getByLabel(`${today.month} 工资调整说明`, { exact:true }).fill("事假 2 天，按工资条修正");

  await expect(page.getByText("已调整 1 个月", { exact:true })).toBeVisible();
  await expect(page.getByText("权益履行总额 ¥ 10,000.00", { exact:true })).toBeVisible();
  await page.getByRole("button", { name:`恢复 ${today.month} 系统预填工资` }).click();
  await expect(wageInput).toHaveValue(String(expectedDue));

  await page.getByRole("button", {name:"查看精算明细"}).click();
  await page.getByLabel("已发工资", {exact:true}).fill(String(expectedDue));
  await expect(page.getByLabel("结清状态", {exact:true})).toHaveText("已结清");
  await wageInput.fill(String(expectedDue + 1));
  await expect(page.getByLabel("结清状态", {exact:true})).toHaveText("未结清");
});

test("previews the monthly housing fund shortfall from the wage-inferred base", async ({ page }) => {
  await fillDepartedBasics(page, "2026-01-01", "2026-03-31");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();
  await page.getByRole("button", { name:/公积金少缴或未缴/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();

  await page.getByRole("button", { name:"缴纳过", exact:true }).click();
  await page.getByLabel("公司实际每月缴纳金额", { exact:false }).fill("250");
  await page.getByLabel("最后缴到哪个月？", { exact:false }).fill("2026-03");

  const preview = page.locator(".fund-formula");
  await expect(preview.getByText("公司实际缴纳 = 填写的单位月缴金额", { exact:true })).toBeVisible();
  await expect(preview.getByText("¥ 250.00", { exact:true })).toBeVisible();
  await expect(preview.getByText("应缴金额 = 工资推定基数 × 系统采用比例", { exact:true })).toBeVisible();
  await expect(preview.getByText("¥ 1,000.00", { exact:true })).toBeVisible();
  await expect(preview.getByText("每月少缴", { exact:true })).toBeVisible();
  await expect(preview.getByText("¥ 750.00", { exact:true })).toBeVisible();
});

test("prefills fund contribution dates from the social-insurance period and keeps them editable", async ({ page }) => {
  await fillDepartedBasics(page, "2025-06-01", "2026-07-31");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();
  await page.getByRole("button", { name:/社保少缴或未缴/ }).click();
  await page.getByRole("button", { name:/公积金少缴或未缴/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();

  const socialModule=page.locator("article.question-module").filter({hasText:"社会保险"});
  await socialModule.getByRole("button", { name:"缴纳过", exact:true }).click();
  await page.locator("#question-social-start").fill("2025-07");
  await page.locator("#question-social-end").fill("2026-05");

  const fundModule=page.locator("article.question-module").filter({hasText:"公积金公司部分"});
  await fundModule.getByRole("button", { name:"缴纳过", exact:true }).click();
  const fundStart=page.locator("#question-fund-start"), fundEnd=page.locator("#question-fund-end");
  await expect(fundStart).toHaveValue("2025-07");
  await expect(fundEnd).toHaveValue("2026-05");
  await expect(fundModule.getByText("沿用社保", { exact:true })).toHaveCount(2);

  await fundStart.fill("2025-08");
  await fundEnd.fill("2026-04");
  await expect(fundStart).toHaveValue("2025-08");
  await expect(fundEnd).toHaveValue("2026-04");
  await expect(fundModule.getByText("已修改", { exact:true })).toHaveCount(2);
});

test("migrates the former default social rates into the current Hangzhou contribution lines", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("xinbao-meta", JSON.stringify({
      version:15,
      caseName:"旧比例迁移测试",
      setup:{
        employmentStatus:"departed", employmentDate:"2026-01-01", departureDate:"2026-01-31", cutoffDate:"2026-01-31", contractPay:20_000,
        socialPensionRate:14, socialUnemploymentRate:2, socialInjuryRate:0.8, socialMaternityRate:0.6, socialMedicalRate:11.5,
      },
      rowsCutoffDate:"2026-01-31",
      selectedClaims:["social"],
      flowStep:"questions",
    }));
  });
  await page.reload();

  await expect(page.getByText("合计 27.6%", { exact:true })).toBeVisible();
  await expect(page.getByLabel("养老保险公司费率")).toHaveValue("16");
  await expect(page.getByLabel("失业保险公司费率")).toHaveValue("1.5");
  await expect(page.getByLabel("工伤保险公司费率")).toHaveValue("0.2");
  await expect(page.getByLabel("职工医保（含生育）公司费率")).toHaveValue("9.9");
  await expect(page.getByLabel("生育保险公司费率")).toHaveCount(0);
});

test("requires review instead of showing stale active rows or guessing a legacy departure", async ({ page }) => {
  const dates = await page.evaluate(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const format = (date:Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    return { today:format(now), yesterday:format(yesterday) };
  });

  await page.evaluate(({ yesterday, row }) => {
    localStorage.setItem("xinbao-rows", JSON.stringify([{...row,wageMonth:yesterday.slice(0,7)}]));
    localStorage.setItem("xinbao-meta", JSON.stringify({
      version:15,
      caseName:"跨日存档",
      setup:{employmentStatus:"active",employmentDate:`${yesterday.slice(0,7)}-01`,cutoffDate:yesterday,contractPay:20_000,arrearsStartMonth:yesterday.slice(0,7)},
      rowsCutoffDate:yesterday,
      selectedClaims:["wage"],
      flowStep:"results",
    }));
  }, {yesterday:dates.yesterday,row:validRow});
  await page.reload();

  await expect(page.getByRole("heading", {name:"先确认基础事实"})).toBeVisible();
  await expect(page.getByLabel("计薪截止日期", {exact:true})).toHaveText(dates.today);
  await expect(page.getByText(`存档明细计算至 ${dates.yesterday}`, {exact:false})).toBeVisible();
  await expect(page.getByRole("button", {name:"修改测算条件"})).toHaveCount(0);

  await page.evaluate(({ yesterday, row }) => {
    localStorage.setItem("xinbao-rows", JSON.stringify([{...row,wageMonth:yesterday.slice(0,7)}]));
    localStorage.setItem("xinbao-meta", JSON.stringify({
      version:13,
      caseName:"旧版存档",
      setup:{employmentDate:`${yesterday.slice(0,7)}-01`,cutoffDate:yesterday,contractPay:20_000},
      selectedClaims:["wage"],
      flowStep:"results",
    }));
  }, {yesterday:dates.yesterday,row:validRow});
  await page.reload();

  await expect(page.getByRole("button", {name:"当前在职"})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("原统计截止日不能证明已经离职", {exact:false})).toBeVisible();
});

test("lets the user close an accidentally selected optional claim and continue", async ({ page }) => {
  await fillDepartedBasics(page, "2026-01-01", "2026-03-31");
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

  await expect(page.getByText("权益履行总额 ¥ 34,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("未休年假折现", { exact:true })).toHaveCount(0);
});

test("prefills an editable one-year contract end date for the double-pay question", async ({ page }) => {
  await fillDepartedBasics(page, "2025-06-10", "2026-07-31");
  await page.getByRole("button", { name:"下一步：选择事项 →" }).click();
  await page.getByRole("button", { name:/未签订劳动合同或合同到期仍在工作/ }).click();
  await page.getByRole("button", { name:"下一步：回答问题 →" }).click();

  const contractEnd=page.locator("#question-contract-end");
  await expect(contractEnd).toHaveValue("2026-06-09");
  await expect(page.getByText("系统推定", { exact:true })).toBeVisible();
  await expect(page.getByText(/暂按入职日期 2025-06-10 作为签约日/)).toBeVisible();
  await contractEnd.fill("2026-05-31");
  await expect(contractEnd).toHaveValue("2026-05-31");
  await expect(page.getByText("已修改", { exact:true })).toBeVisible();
});

test("explains missing or conflicting answers and jumps directly to the field", async ({ page }) => {
  await fillDepartedBasics(page, "2026-01-01", "2026-03-31");
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
  await expect(page.getByText("开始欠薪月份必须位于入职月份和计薪截止月份之间。", { exact:true })).toBeVisible();
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
  await expect(page.getByText("先确认基础事实", { exact:true })).toBeVisible();
  await expect(page.getByText("测算结果已生成", { exact:true })).toHaveCount(0);
});

test("imports a valid backup and renders its calculated result", async ({ page }) => {
  const validBackup = {
    version:15,
    caseName:"有效备份",
    setup:{ employmentStatus:"departed", employmentDate:"2026-01-01", departureDate:"2026-01-31", cutoffDate:"2026-01-31", contractPay:20_000, arrearsStartMonth:"2026-01" },
    rowsCutoffDate:"2026-01-31",
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
  await expect(page.getByText("权益履行总额 ¥ 20,000.00", { exact:true })).toBeVisible();
  await expect(page.getByText("测算结果已生成", { exact:true })).toBeVisible();
});

test("shows a balanced allocation between the worker and contribution accounts", async ({ page }) => {
  const allocationBackup = {
    version:15,
    caseName:"权益履行分配测试",
    setup:{
      employmentStatus:"departed", employmentDate:"2026-01-01", departureDate:"2026-01-31", cutoffDate:"2026-01-31", contractPay:20_000, arrearsStartMonth:"2026-01",
      socialBase:20_000, socialHasPaid:false,
      socialPersonalPensionRate:8, socialPersonalUnemploymentRate:0.5, socialPersonalInjuryRate:0,
      socialPersonalMaternityRate:0, socialPersonalMedicalRate:2,
      fundBase:20_000, fundRate:5, fundPersonalRate:5, fundHasPaid:false,
    },
    rowsCutoffDate:"2026-01-31",
    selectedClaims:["wage","social","fund"],
    flowStep:"results",
    doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
    rows:[validRow],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name:"allocation-backup.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(allocationBackup)),
  });

  const allocation=page.getByLabel("权益履行与资金去向");
  await expect(allocation.getByText("权益履行总额", { exact:true })).toBeVisible();
  await expect(allocation.getByText("¥ 26,780.00", { exact:true }).first()).toBeVisible();
  await expect(allocation.getByText("个人应缴部分", { exact:true })).toBeVisible();
  await expect(allocation.getByText("¥ 3,100.00", { exact:true })).toBeVisible();
  await expect(allocation.getByText("预计个人实际取得", { exact:true })).toBeVisible();
  await expect(allocation.getByText("¥ 16,900.00", { exact:true }).first()).toBeVisible();
  await expect(allocation.getByText("缴入社保", { exact:true })).toBeVisible();
  await expect(allocation.getByText("¥ 7,880.00", { exact:true })).toBeVisible();
  await expect(allocation.getByText("缴入公积金", { exact:true })).toBeVisible();
  await expect(allocation.getByText("¥ 2,000.00", { exact:true })).toBeVisible();
});

test("renders a personalized enforcement route and expandable evidence list", async ({ page }) => {
  const routedBackup = {
    version:15,
    caseName:"社保与被迫离职路径测试",
    setup:{
      employmentStatus:"departed", employmentDate:"2025-01-01", departureDate:"2026-01-31", cutoffDate:"2026-01-31", contractPay:20_000,
      socialHasPaid:true, socialActualBase:5_000, socialBase:20_000,
      fundHasPaid:true, fundPaid:250, fundBase:20_000, fundRate:5,
      terminationType:"forced", terminationAveragePay:20_000,
      personalResignationSigned:"yes", forcedNoticeSent:"yes", forcedNoticeProof:"yes",
    },
    rowsCutoffDate:"2026-01-31",
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
    version:15,
    caseName:"五条维权路径布局测试",
    setup:{
      employmentStatus:"departed", employmentDate:"2025-01-01", departureDate:"2026-01-31", cutoffDate:"2026-01-31", contractPay:20_000,
      arrearsStartMonth:"2026-01", firstArrearsPaidRate:0,
      socialHasPaid:false, socialBase:20_000,
      fundHasPaid:false, fundBase:20_000, fundRate:5,
    },
    rowsCutoffDate:"2026-01-31",
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
    version:15,
    caseName:"解除通知布局测试",
    setup:{
      employmentStatus:"departed", employmentDate:"2025-01-01", departureDate:"2026-07-17", cutoffDate:"2026-07-17", contractPay:20_000,
      terminationType:"forced", terminationAveragePay:20_000,
      personalResignationSigned:"unknown", forcedNoticeSent:"yes", forcedNoticeProof:"unknown",
    },
    rowsCutoffDate:"2026-07-17",
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
  await returnToQuestionsFromResults(page);

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

test("generates personalized Markdown and Word notices when article 38 notice is unsent", async ({ page }) => {
  const noticeBackup = {
    version:15,
    caseName:"解除通知下载测试",
    setup:{
      employmentStatus:"departed", employmentDate:"2025-01-01", departureDate:"2026-07-17", cutoffDate:"2026-07-17", contractPay:20_000,
      arrearsStartMonth:"2026-01", firstArrearsPaidRate:0,
      terminationType:"forced", terminationAveragePay:20_000,
      personalResignationSigned:"no", forcedNoticeSent:"no", forcedNoticeProof:"unknown",
    },
    rowsCutoffDate:"2026-07-17",
    selectedClaims:["wage", "social", "fund", "doublePay", "reimbursement", "annualLeave", "overtime", "termination"],
    flowStep:"questions",
    doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
    rows:[validRow],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name:"termination-notice.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(noticeBackup)),
  });
  await returnToQuestionsFromResults(page);

  await expect(page.getByRole("heading", { name:"生成解除劳动合同通知书" })).toBeVisible();
  await expect(page.getByText("未及时足额支付劳动报酬", { exact:true })).toBeVisible();
  const preloadedRights=page.getByRole("group", { name:"选择随通知一并列明的待处理权益" });
  for (const label of ["欠付工资", "社会保险核查补缴", "住房公积金核查补缴", "未支付的工作费用报销", "未支付的加班工资"]) {
    await expect(preloadedRights.getByText(label, { exact:true })).toBeVisible();
  }
  await expect(preloadedRights.getByText("未订立书面劳动合同或合同期满继续用工的双倍工资差额", { exact:true })).toHaveCount(0);
  await expect(preloadedRights.getByText("未休年休假工资报酬", { exact:true })).toHaveCount(0);
  await preloadedRights.getByLabel("通知列明：住房公积金核查补缴").check();
  await page.getByLabel("解除通知劳动者姓名").fill("张三");
  await page.getByLabel("解除通知用人单位全称").fill("示例科技有限公司");
  await expect(page.getByRole("button", { name:"生成 PDF" })).toBeEnabled();

  const markdownDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name:"下载 Markdown" }).click();
  const markdownDownload = await markdownDownloadPromise;
  expect(markdownDownload.suggestedFilename()).toMatch(/^张三-解除劳动合同通知书-\d{4}-\d{2}-\d{2}\.md$/);
  const markdownStream = await markdownDownload.createReadStream();
  const markdownChunks:Buffer[] = [];
  for await (const chunk of markdownStream) markdownChunks.push(Buffer.from(chunk));
  const markdown = Buffer.concat(markdownChunks).toString("utf8");
  expect(markdown).toContain("示例科技有限公司");
  expect(markdown).toContain("第三十八条第一款第二项");
  expect(markdown).toContain("随通知一并列明的待处理权益事项");
  expect(markdown).toContain("住房公积金不等同于社会保险");
  expect(markdown).not.toContain("双倍工资差额");
  expect(markdown).not.toContain("未休年休假工资报酬");

  const wordDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name:"下载 Word（.doc）" }).click();
  const wordDownload = await wordDownloadPromise;
  expect(wordDownload.suggestedFilename()).toMatch(/\.doc$/);
  const wordStream = await wordDownload.createReadStream();
  const wordChunks:Buffer[] = [];
  for await (const chunk of wordStream) wordChunks.push(Buffer.from(chunk));
  const word = Buffer.concat(wordChunks).toString("utf8");
  expect(word).toContain("@page{size:A4");
  expect(word).toContain("示例科技有限公司");

  const layout = await page.locator(".termination-notice-builder").evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width:Math.round(rect.width), scrollWidth:element.scrollWidth, clientWidth:element.clientWidth };
  });
  expect(layout.width).toBeGreaterThan(700);
  expect(layout.scrollWidth).toBe(layout.clientWidth);
});

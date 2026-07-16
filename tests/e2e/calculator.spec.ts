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

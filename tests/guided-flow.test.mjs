import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defaults to a progressive guided calculator", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /type FlowStep = "basic" \| "scenario" \| "questions" \| "review" \| "results"/);
  assert.match(page, /基础事实/);
  assert.match(page, /选择要计算的事项/);
  assert.match(page, /系统推定/);
  assert.match(page, /查看精算明细/);
  assert.match(page, /selectedClaims\.includes\("wage"\)/);
  assert.match(page, /flowStep === "results"/);
});

test("keeps unselected claims out of generated rows", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /wageEnabled/);
  assert.match(page, /socialEnabled/);
  assert.match(page, /fundEnabled/);
  assert.match(page, /doublePayEnabled/);
  assert.match(page, /精算明细仅用于复核/);
});

test("asks for actual company contributions and explains statutory rate ranges", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /公司实际每月缴纳金额/);
  assert.match(page, /养老保险单位部分 16%/);
  assert.match(page, /社保合计比例由参保地确定/);
  assert.match(page, /单位缴存比例法定范围 5%–12%/);
  assert.match(page, /修改测算基数/);
});

test("infers paid rates from contract salary and applies editable legal floors", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /socialBase\|\|setup\.contractPay/);
  assert.match(page, /fundBase\|\|setup\.contractPay/);
  assert.match(page, /Math\.max\(inferredSocialPaidRate/);
  assert.match(page, /Math\.max\(inferredFundPaidRate/);
  assert.match(page, /当地最低公司比例（可修改）/);
  assert.match(page, /实际缴纳金额 ÷ 测算基数/);
  assert.match(page, /系统采用比例/);
  assert.match(page, /socialRate: 16/);
  assert.match(page, /fundRate: 5/);
});

test("does not ask users for a contract start date that the calculation does not use", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /劳动合同开始日/);
  assert.match(page, /合同上写的最后一天/);
  assert.match(page, /双倍工资只需要合同期满日/);
});

test("aligns contract salary with date inputs without a currency icon", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /salary-field/);
  assert.match(page, /salary-input/);
  assert.match(page, /元\/月/);
  assert.match(page, /劳动合同约定的税前月工资/);
  assert.doesNotMatch(page, /salary-input"><i>¥<\/i>/);
  assert.match(css, /\.salary-input/);
  assert.match(css, /\.salary-field \.salary-input\{height:42px/);
  assert.doesNotMatch(css, /\.salary-field \.salary-input i\{/);
});

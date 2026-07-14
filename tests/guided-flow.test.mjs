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

test("adds reimbursement as an optional claim with an explicit total policy", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /type Claim = "wage" \| "social" \| "fund" \| "doublePay" \| "reimbursement"/);
  assert.match(page, /报销费用未支付/);
  assert.match(page, /尚未支付的报销金额/);
  assert.match(page, /reimbursementAmount/);
  assert.match(page, /reimbursementIncluded/);
  assert.match(page, /计入本次合计/);
  assert.match(page, /仅在报告中记录/);
  assert.match(page, /reimbursementEnabled&&setup\.reimbursementIncluded/);
  assert.match(page, /version:7/);
});

test("provides a self-contained A4 report that exports through system print", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /导出报告/);
  assert.match(page, /window\.print\(\)/);
  assert.match(page, /className="print-report"/);
  assert.match(page, /SYSTEM GENERATED REPORT \/ 系统生成报告/);
  assert.match(page, /工资、社保及报销/);
  assert.match(page, /报告编号/);
  assert.match(page, /报销口径/);
  assert.match(css, /@page\{size:A4/);
  assert.match(css, /@media print/);
  assert.match(css, /\.app-shell>\*:not\(\.print-report\)/);
  assert.match(css, /\.report-pattern/);
});

test("calculates social insurance from the actual declared base and five employer rates", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /公司实际申报缴费基数/);
  assert.match(page, /养老保险/);
  assert.match(page, /失业保险/);
  assert.match(page, /工伤保险/);
  assert.match(page, /生育保险/);
  assert.match(page, /医疗保险/);
  assert.match(page, /socialActualBase/);
  assert.match(page, /五险公司费率合计/);
  assert.match(page, /单位缴存比例法定范围 5%–12%/);
  assert.match(page, /修改应缴测算基数/);
});

test("uses the contract salary as the expected base while keeping fund floors", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /socialBase\|\|setup\.contractPay/);
  assert.match(page, /fundBase\|\|setup\.contractPay/);
  assert.match(page, /Math\.max\(inferredFundPaidRate/);
  assert.match(page, /公司实际缴纳 = 实际申报基数 × 五险公司费率合计/);
  assert.match(page, /应缴金额 = 应缴测算基数 × 五险公司费率合计/);
  assert.match(page, /fundRate: 5/);
});

test("computes five-insurance actual payment and shortfall from two bases", async () => {
  const { DEFAULT_SOCIAL_RATES, totalEmployerRate, socialContributionForMonth, declaredBaseFromPaidAmount } = await import("../app/contribution-calculator.mjs");
  assert.equal(totalEmployerRate(DEFAULT_SOCIAL_RATES), 28.9);
  assert.deepEqual(socialContributionForMonth({ expectedBase: 20_000, actualBase: 4_986, rates: DEFAULT_SOCIAL_RATES }), {
    rate: 28.9,
    expected: 5_780,
    actual: 1_440.954,
    gap: 4_339.046,
  });
  assert.equal(declaredBaseFromPaidAmount(398.88, DEFAULT_SOCIAL_RATES), 1_380.208);
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

test("places the custom arrears rate after 100 percent at matching height", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const theme = await readFile(new URL("../app/glass-theme.css", import.meta.url), "utf8");
  assert.match(page, /\[0,30,50,100\]\.map[\s\S]*custom-rate-input/);
  assert.match(css, /\.wage-rate-choices\{grid-template-columns:repeat\(5/);
  assert.match(css, /\.wage-rate-choices \.custom-rate-input\{height:31px/);
  assert.match(theme, /\.wage-rate-choices \{[\s\S]*grid-template-columns: repeat\(4, minmax\(88px, 1fr\)\) minmax\(150px, 1\.2fr\)/);
  assert.match(theme, /\.wage-rate-choices \.custom-rate-input \{[\s\S]*grid-template-columns: 42px minmax\(0, 1fr\)/);
  assert.match(theme, /\.custom-rate-input input::?-webkit-inner-spin-button/);
});

test("does not display already-paid normal wages in the result summary", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /另有已发工资/);
  assert.match(page, /后续补发工资/);
  assert.match(page, /totals\.normal/);
});

test("uses aligned sans-serif numerals for calculation results", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--number-font:Arial/);
  assert.match(css, /font-variant-numeric:lining-nums tabular-nums/);
  assert.match(css, /font-feature-settings:"lnum" 1,"tnum" 1/);
  assert.match(css, /\.grand-card>strong,\.metrics strong,[^{]*\.result-ready strong,[^{]*\{font-family:var\(--number-font\)/);
  assert.match(css, /body,button,input,select,table\{font-variant-numeric:lining-nums tabular-nums/);
});

test("applies the scenic glass redesign without weakening form accessibility", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const theme = await readFile(new URL("../app/glass-theme.css", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/glass-theme\.css"/);
  assert.match(page, /<main className="app-shell">/);
  assert.match(page, /className="skip-link"/);
  assert.match(page, /id="calculator"/);
  assert.match(theme, /backdrop-filter: blur\(/);
  assert.match(theme, /min-height: 44px/);
  assert.match(theme, /:focus-visible/);
  assert.match(theme, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(theme, /@media \(max-width: 680px\)/);
});

test("keeps compound money inputs unobstructed while focused", async () => {
  const theme = await readFile(new URL("../app/glass-theme.css", import.meta.url), "utf8");
  assert.match(theme, /\.module-fields \.money-input input:focus[\s\S]*border: 0/);
  assert.match(theme, /\.app-shell \.money-input input:focus-visible[\s\S]*outline: none/);
  assert.match(theme, /\.money-input:focus-within[\s\S]*box-shadow:/);
});

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
  assert.match(page, /exceptionRows\.map/);
  assert.doesNotMatch(page, /exceptionRows\.slice\(0,8\)/);
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
  assert.match(page, /version:10/);
});

test("adds annual leave, overtime and uncompensated rest-day leave to the guided total and report", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /annualLeave/);
  assert.match(page, /overtime/);
  assert.match(page, /compTime/);
  assert.match(page, /未休年假折现/);
  assert.match(page, /工作日延时加班/);
  assert.match(page, /休息日加班尚未补休/);
  assert.match(page, /书面主动放弃/);
  assert.match(page, /不得与“休息日加班工资”重复填写/);
  assert.match(page, /annualLeaveTotal/);
  assert.match(page, /overtimeTotal/);
  assert.match(page, /compTimeTotal/);
  assert.match(page, /version:10/);
});

test("lets users close optional rights modules without clearing their draft values", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /aria-label="关闭未休年假折现"/);
  assert.match(page, /aria-label="关闭加班工资未支付"/);
  assert.match(page, /aria-label="关闭调休尚未兑现"/);
  assert.match(page, /onClick=\{\(\)=>closeClaim\("annualLeave"\)\}/);
  assert.match(page, /onClick=\{\(\)=>closeClaim\("overtime"\)\}/);
  assert.match(page, /onClick=\{\(\)=>closeClaim\("compTime"\)\}/);
  assert.match(page, /const closeClaim=\(claim:Claim\)=>setSelectedClaims\(current=>current\.filter\(item=>item!==claim\)\)/);
  assert.match(css, /\.question-close/);
  assert.doesNotMatch(page, /closeClaim=.*setSetup/);
});

test("uses the salary calculator name and explains prorated annual leave days", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(page, /薪资计算器/);
  assert.match(layout, /薪资计算器｜工资、社保、年假与加班权益测算/);
  assert.match(readme, /^# 薪资计算器$/m);
  assert.doesNotMatch(`${page}\n${layout}\n${readme}`, /薪保计算器|薪保清算台/);
  assert.match(page, /currentYearEmploymentDays/);
  assert.match(page, /截至统计日折算未休/);
  assert.match(page, /当年在职 \{annualLeaveElapsedDays\} 天 ÷ 365 × 全年 \{annualLeaveStatutoryDays\} 天/);
  assert.doesNotMatch(layout, /og\.png/);
});

test("adds mutually exclusive N and N plus X termination compensation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /\| "termination"/);
  assert.match(page, /离职经济补偿/);
  assert.match(page, /被迫离职（N）/);
  assert.match(page, /裁员\/公司解除（N\+X）/);
  assert.match(page, /terminationType/);
  assert.match(page, /terminationAdditionalMonths/);
  assert.match(page, /是否已经发送依据第 38 条解除劳动合同的通知/);
  assert.match(page, /是否保留通知送达证明/);
  assert.match(page, /forcedNoticeSent/);
  assert.match(page, /forcedNoticeProof/);
  assert.match(page, /min="0" max="9" step="1"/);
  assert.match(page, /经济性裁员通常为 N，并不当然增加 1 个月/);
  assert.match(page, /terminationCompensation/);
  assert.match(page, /terminationTotal/);
  assert.match(page, /离职经济补偿.*money\(terminationTotal\)/s);
  assert.match(page, /version:10/);
});

test("adds a closable work injury screening without adding an estimated award to the total", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /\| "workInjury"/);
  assert.match(page, /工伤情况初筛/);
  assert.match(page, /资格与申报期限初筛，不计入合计/);
  assert.match(page, /aria-label="关闭工伤情况初筛"/);
  assert.match(page, /workInjuryScreening/);
  assert.match(page, /事故后 30 日内/);
  assert.match(page, /事故后 1 年内/);
  assert.match(page, /工伤认定申请表、劳动关系证明、医疗诊断或职业病诊断材料/);
  assert.doesNotMatch(page, /grandTotal=.*workInjury/);
  assert.match(css, /\.injury-screening/);
  assert.match(css, /\.injury-kind>button:focus-visible/);
});

test("provides a restrained Swiss-style A4 report that exports through system print", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const reportCss = css.slice(css.indexOf("/* Printable report */"));
  assert.match(page, /导出报告/);
  assert.match(page, /window\.print\(\)/);
  assert.match(page, /className="print-report"/);
  assert.match(page, /系统生成报告 · SYSTEM GENERATED REPORT/);
  assert.match(page, /工资、社保及劳动权益/);
  assert.match(page, /报告编号/);
  assert.match(page, /报销口径/);
  assert.match(css, /@page\{size:A4/);
  assert.match(css, /@media print/);
  assert.match(css, /\.app-shell>\*:not\(\.print-report\)/);
  assert.match(css, /\.report-export\{[^}]*color:#fff!important/);
  assert.match(page, /className="report-masthead"/);
  assert.match(page, /className="report-summary-table"/);
  assert.match(page, /className="report-section-index"/);
  assert.match(page, /报告末页/);
  assert.match(css, /--report-accent:/);
  assert.match(css, /font-variant-numeric:tabular-nums/);
  assert.match(css, /\.report-summary-table[\s\S]*text-align:right/);
  assert.match(css, /\.report-summary-table\{[^}]*min-width:0/);
  assert.match(css, /\.report-summary-table th,\.report-summary-table td\{[^}]*position:static[^}]*height:auto[^}]*background:transparent/);
  assert.match(css, /\.report-summary-table tfoot td\{[^}]*position:static[^}]*background:transparent!important/);
  assert.doesNotMatch(page, /report-pattern|report-barcode|report-code/);
  assert.doesNotMatch(reportCss, /repeating-conic-gradient|repeating-linear-gradient/);
  assert.doesNotMatch(reportCss, /border-(?:top|bottom):1px (?:dotted|dashed)/);
});

test("adds a nationwide rights-enforcement route matrix to the end of the report", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /维权路径建议/);
  assert.match(page, /劳动保障监察投诉/);
  assert.match(page, /劳动人事争议仲裁/);
  assert.match(page, /申请支付令/);
  assert.match(page, /社保与公积金专项处理/);
  assert.match(page, /委托律师或申请法律援助/);
  assert.match(page, /住房公积金管理中心/);
  assert.match(page, /不改变本报告任何测算金额/);
  assert.match(page, /一般仲裁时效为 1 年/);
  assert.match(page, /连续或继续状态自行为终了之日起计算/);
  assert.match(page, /主要全国性依据/);
  assert.match(css, /\.report-rights-plan/);
  assert.match(css, /\.report-route-table\{[^}]*table-layout:fixed/);
  assert.match(css, /\.report-rights-plan\{break-inside:auto/);
  assert.match(css, /\.report-route-table tr\{break-inside:avoid/);
  assert.match(css, /\.report-rights-plan>header\{break-after:avoid/);
  assert.doesNotMatch(css, /\.report-rights-plan\{break-before:page/);
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
  assert.match(page, /默认参考比例/);
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
  assert.match(page, /未签订劳动合同或合同到期仍在工作/);
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
  const theme = await readFile(new URL("../app/vandslab-theme.css", import.meta.url), "utf8");
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

test("limits displayed and exported numeric precision to two decimal places", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /minimumFractionDigits: 2, maximumFractionDigits: 2/);
  assert.match(page, /const csvValue = .*value\.toFixed\(2\)/);
  assert.match(page, /step="0\.01"/);
  assert.doesNotMatch(page, /toFixed\(1\)/);
  assert.doesNotMatch(page, /step="0\.001"/);
});

test("uses aligned sans-serif numerals for calculation results", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--number-font:Arial/);
  assert.match(css, /font-variant-numeric:lining-nums tabular-nums/);
  assert.match(css, /font-feature-settings:"lnum" 1,"tnum" 1/);
  assert.match(css, /\.grand-card>strong,\.metrics strong,[^{]*\.result-ready strong,[^{]*\{font-family:var\(--number-font\)/);
  assert.match(css, /body,button,input,select,table\{font-variant-numeric:lining-nums tabular-nums/);
});

test("applies the editorial-tech design system without weakening form accessibility", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const tokens = await readFile(new URL("../app/design-tokens.css", import.meta.url), "utf8");
  const theme = await readFile(new URL("../app/vandslab-theme.css", import.meta.url), "utf8");
  const reportTheme = await readFile(new URL("../app/report-theme.css", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/design-tokens\.css"/);
  assert.match(layout, /import "\.\/vandslab-theme\.css"/);
  assert.match(layout, /import "\.\/report-theme\.css"/);
  assert.match(page, /<main className="app-shell">/);
  assert.match(page, /className="skip-link"/);
  assert.match(page, /id="calculator"/);
  assert.match(page, /className="hero-interrupt"/);
  assert.match(tokens, /--vd-color-acid: #efff84/);
  assert.match(tokens, /--vd-type-body-on-dark:/);
  assert.match(tokens, /--vd-type-caption-on-light:/);
  assert.match(tokens, /--vd-font-size-caption: 0\.75rem/);
  assert.match(tokens, /--vd-font-size-label: 0\.8125rem/);
  assert.match(tokens, /--vd-text-caption: var\(--vd-font-size-caption\)/);
  assert.match(theme, /background: var\(--vd-surface-stage\)/);
  assert.match(theme, /\.exception-row > b \{ color: var\(--vd-type-body-on-dark\)/);
  assert.match(theme, /clip-path: polygon\(/);
  assert.doesNotMatch(theme, /gradient\(/);
  assert.doesNotMatch(theme, /backdrop-filter/);
  assert.match(theme, /min-height: var\(--vd-button-height\)/);
  assert.match(theme, /\.app-shell small,[\s\S]*font-size: var\(--vd-text-caption\)/);
  assert.match(theme, /\.metric-icon \{[^}]*background: var\(--vd-surface-action\) !important/);
  assert.match(theme, /\.sheet \.row-total,[\s\S]*\.sheet tfoot td \{ white-space: nowrap/);
  assert.match(theme, /:focus-visible/);
  assert.match(theme, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(theme, /@media screen and \(max-width: 430px\)/);
  assert.match(reportTheme, /--report-accent: var\(--vd-color-acid\)/);
  assert.match(reportTheme, /\.report-executive \{[\s\S]*background: var\(--report-ink\)/);
  assert.match(reportTheme, /\.report-summary-table thead th \{[\s\S]*background: var\(--report-ink\)/);
  assert.match(reportTheme, /\.report-summary-table tfoot td \{[\s\S]*background: var\(--report-accent\) !important/);
  assert.doesNotMatch(reportTheme, /gradient\(/);
});

test("keeps compound money inputs unobstructed while focused", async () => {
  const theme = await readFile(new URL("../app/vandslab-theme.css", import.meta.url), "utf8");
  assert.match(theme, /\.module-fields \.money-input input:focus[\s\S]*border: 0/);
  assert.match(theme, /\.money-input:focus-within[\s\S]*outline: 2px solid var\(--vd-color-ink\)/);
  assert.match(theme, /\.money-input input,[\s\S]*outline: 0/);
});

import assert from "node:assert/strict";
import test from "node:test";

import { buildRightsRoutePlan } from "../app/rights-route-planner.mjs";

test("routes contribution gaps to administrative verification before arbitration", () => {
  const plan = buildRightsRoutePlan({ socialEnabled:true, socialDue:26_000, socialHasPaid:true, fundEnabled:true, fundDue:6_000, fundHasPaid:true });
  assert.deepEqual(plan.routes.map(route => route.id), ["contribution", "remain-employed"]);
  assert.match(plan.routes[0].title, /社会保险和住房公积金核查补缴/);
  assert.match(plan.routes[0].description, /分别进入对应行政核查渠道/);
  assert.match(plan.routes[0].steps.join("\n"), /12333/);
  assert.match(plan.routes[0].steps.join("\n"), /12329/);
  assert.match(plan.routes[0].steps.join("\n"), /先通过人社\/社保或税务渠道核实社保缴费基数和个税工资薪金收入/);
  assert.match(plan.routes[0].steps.join("\n"), /公积金缴存基数最终由公积金中心按工资口径和当地规则认定/);
  assert.match(plan.routes[0].caution, /不是投诉的全国统一法定前置程序/);
});

test("separates labor-money claims from contribution recovery", () => {
  const plan = buildRightsRoutePlan({ wageDue:30_000, socialEnabled:true, socialDue:8_000, socialHasPaid:false });
  assert.deepEqual(plan.routes.map(route => route.id), ["contribution", "labor", "payment-order", "wage-crime", "remain-employed"]);
  assert.match(plan.summary, /分开走对应程序/);
  assert.match(plan.routes[1].title, /劳动监察催发/);
});

test("adds a payment-order path only when the calculation contains wage arrears", () => {
  const wagePlan = buildRightsRoutePlan({ wageDue:30_000 });
  const paymentOrder = wagePlan.routes.find(route => route.id === "payment-order");
  assert.match(paymentOrder.title, /申请支付令/);
  assert.match(paymentOrder.suitable, /已经到期、金额确定/);
  assert.match(paymentOrder.steps.join("\n"), /基层人民法院/);
  assert.match(paymentOrder.caution, /书面异议/);

  const annualLeavePlan = buildRightsRoutePlan({ annualLeaveDue:4_000 });
  assert.equal(annualLeavePlan.routes.some(route => route.id === "payment-order"), false);
});

test("does not equate wage arrears with the crime of refusing to pay labor remuneration", () => {
  const plan = buildRightsRoutePlan({ wageDue:30_000 });
  const wageCrime = plan.routes.find(route => route.id === "wage-crime");
  assert.match(wageCrime.title, /恶意欠薪/);
  assert.match(wageCrime.suitable, /存在欠薪不等于犯罪/);
  assert.match(wageCrime.description, /拒不支付劳动报酬罪/);
  assert.match(wageCrime.steps.join("\n"), /全国根治欠薪线索反映平台/);
  assert.match(wageCrime.steps.join("\n"), /责令支付/);
  assert.match(wageCrime.caution, /不要仅凭欠薪金额/);
});

test("does not promise forced-termination compensation for an underpaid base", () => {
  const plan = buildRightsRoutePlan({
    socialEnabled:true, socialDue:8_000, socialHasPaid:true,
    terminationEnabled:true, terminationType:"forced",
    personalResignationSigned:"no", forcedNoticeSent:"no", forcedNoticeProof:"unknown",
  });
  const forced = plan.routes.find(route => route.id === "forced-termination");
  assert.equal(forced.badge, "条件评估");
  assert.match(forced.title, /不要写普通辞职/);
  assert.match(forced.caution, /基数偏低/);
  assert.match(forced.caution, /地区裁审风险/);
});

test("escalates conflicting resignation documents to professional review", () => {
  const plan = buildRightsRoutePlan({
    terminationEnabled:true, terminationType:"forced",
    personalResignationSigned:"yes", forcedNoticeSent:"yes", forcedNoticeProof:"yes",
  });
  const forced = plan.routes.find(route => route.id === "forced-termination");
  assert.equal(forced.badge, "高风险");
  assert.match(forced.title, /专业复核/);
  assert.match(forced.description, /相互矛盾/);
});

test("includes evidence that matches the selected disputes", () => {
  const plan = buildRightsRoutePlan({ wageDue:20_000, socialEnabled:true, socialDue:3_000, socialHasPaid:false, workInjuryEnabled:true });
  const evidence = plan.evidence.join("\n");
  assert.match(evidence, /劳动关系证明/);
  assert.match(evidence, /官方社保缴费明细/);
  assert.match(evidence, /病历/);
});

import assert from "node:assert/strict";
import test from "node:test";

import { contributionGap, rowSettlementStatus, wageArrears } from "../app/row-calculator.mjs";

test("derives settlement status from current wage and contribution obligations", () => {
  const row = {duePay:10_000,normalPay:10_000,paid:0,socialBase:0,socialRate:0,socialPaid:0,fundBase:0,fundRate:0,fundPaid:0};
  assert.equal(rowSettlementStatus(row), "已结清");
  assert.equal(rowSettlementStatus({...row,duePay:12_000}), "未结清");
  assert.equal(rowSettlementStatus({...row,socialBase:4_986,socialRate:28.9}), "未结清");
  assert.equal(rowSettlementStatus({...row,fundBase:10_000,fundRate:5,fundPaid:500}), "已结清");
});

test("rounds derived arrears and contribution gaps to cents", () => {
  assert.equal(wageArrears({duePay:10_000.005,normalPay:1_000,paid:0}), 9_000.01);
  assert.equal(contributionGap({base:4_986,rate:28.9,paid:0}), 1_440.95);
});

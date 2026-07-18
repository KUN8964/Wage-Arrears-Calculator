import assert from "node:assert/strict";
import test from "node:test";

import { roundMoney, sumMoney } from "../app/money-utils.mjs";
import { personalContributionsForArrears, socialContributionForMonth } from "../app/contribution-calculator.mjs";

test("rounds every independent monetary line to cents before summing", () => {
  assert.equal(roundMoney(1_440.954), 1_440.95);
  assert.equal(sumMoney([1_440.954, 1_440.954]), 2_881.90);

  const month = socialContributionForMonth({
    expectedBase:4_986,
    actualBase:0,
    rates:{ pension:28.9, unemployment:0, injury:0, maternity:0, medical:0 },
  });
  assert.equal(month.expected, 1_440.95);
  assert.equal(sumMoney([month.expected, month.expected]), 2_881.90);
});

test("handles invalid and negative values without fractions of a cent", () => {
  assert.equal(roundMoney(Number.NaN), 0);
  assert.equal(roundMoney(-1.005), -1.01);
  assert.equal(sumMoney([10.005, -1.005]), 9);
});

test("does not let independently rounded personal contributions exceed unpaid wages", () => {
  assert.deepEqual(personalContributionsForArrears({
    arrears:0.01,grossWage:0.01,socialBase:1,socialRate:0.5,fundBase:1,fundRate:0.5,
  }), {arrearsRatio:1,social:0.01,fund:0,total:0.01});
});
